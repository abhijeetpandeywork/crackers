import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api/v1";

type AuditRow = {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

async function api<T>(path: string): Promise<T> {
  const token = localStorage.getItem("erp_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const actionColor: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export default function ActivityReport() {
  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: AuditRow[]; meta: { total: number; pages: number } } | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType !== "all") params.set("entityType", entityType);
      if (action !== "all") params.set("action", action);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      params.set("page", String(page));
      params.set("limit", "25");
      const json = await api<{ success: boolean; data: AuditRow[]; meta: { total: number; pages: number } }>(
        `/audit-log?${params.toString()}`,
      );
      setData({ data: json.data, meta: json.meta });
    } catch {
      setData({ data: [], meta: { total: 0, pages: 0 } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api<{ success: boolean; data: string[] }>("/audit-log/entity-types")
      .then((j) => setTypes(j.data ?? []))
      .catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every change made to settings, products, customers, coupons, brands and the website CMS — who changed
          what, and when.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-xs">Entity</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            setPage(1);
            void reload();
          }}
          data-testid="activity-apply"
        >
          Apply
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="w-[80px]">Diff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            )}
            {!loading && (data?.data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No activity recorded for this filter.</TableCell></TableRow>
            )}
            {!loading && data?.data?.map((row) => (
              <>
                <TableRow key={row.id} data-testid="activity-row">
                  <TableCell className="text-xs text-muted-foreground">{fmt.format(new Date(row.createdAt))}</TableCell>
                  <TableCell>
                    <div className="text-sm">{row.actorName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.actorRole ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColor[row.action] ?? ""} variant="secondary">{row.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{row.entityType}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">{row.entityId ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                      {expanded === row.id ? "Hide" : "View"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === row.id && (
                  <TableRow key={row.id + "-diff"}>
                    <TableCell colSpan={5} className="bg-muted/40">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                        <div>
                          <div className="font-semibold mb-1">Before</div>
                          <pre className="overflow-auto max-h-72 bg-background p-2 rounded border">{JSON.stringify(row.before, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">After</div>
                          <pre className="overflow-auto max-h-72 bg-background p-2 rounded border">{JSON.stringify(row.after, null, 2)}</pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          {data?.meta?.total ?? 0} entries · page {page} of {data?.meta?.pages ?? 1}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button variant="outline" size="sm" disabled={!data || page >= (data.meta.pages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
