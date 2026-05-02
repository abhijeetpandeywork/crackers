import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

type Check = {
  name: string;
  passed: boolean;
  detail?: string;
};

type Section = {
  name: string;
  status: "pending" | "running" | "done";
  checks: Check[];
};

async function http(path: string, init: RequestInit = {}) {
  const res = await fetch(path, init);
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body };
}

async function login(username: string, password: string): Promise<string | null> {
  const r = await http("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (r.status !== 200) return null;
  const b = r.body as { data?: { accessToken?: string } };
  return b?.data?.accessToken ?? null;
}

const SECTIONS: Array<{ name: string; run: () => Promise<Check[]> }> = [
  {
    name: "Infrastructure",
    run: async () => {
      const out: Check[] = [];
      const h = await http("/api/healthz");
      out.push({ name: "API health endpoint /api/healthz", passed: h.status === 200, detail: `status=${h.status}` });
      out.push({ name: "Health body status:ok", passed: (h.body as { status?: string })?.status === "ok" });
      const erp = await fetch("/").then(r => r.status).catch(() => 0);
      out.push({ name: "ERP frontend at /", passed: erp < 500, detail: `status=${erp}` });
      const pos = await fetch("/pos/").then(r => r.status).catch(() => 0);
      out.push({ name: "POS frontend at /pos/", passed: pos < 500, detail: `status=${pos}` });
      const wh = await fetch("/warehouse/").then(r => r.status).catch(() => 0);
      out.push({ name: "Warehouse frontend at /warehouse/", passed: wh < 500, detail: `status=${wh}` });
      const web = await fetch("/website/").then(r => r.status).catch(() => 0);
      out.push({ name: "Website frontend at /website/", passed: web < 500, detail: `status=${web}` });
      return out;
    },
  },
  {
    name: "Authentication & RBAC",
    run: async () => {
      const out: Check[] = [];
      const noAuth = await http("/api/v1/products");
      out.push({ name: "Protected route returns 401 without token", passed: noAuth.status === 401, detail: `status=${noAuth.status}` });
      const bad = await http("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong" }),
      });
      out.push({ name: "Wrong password returns 401", passed: bad.status === 401, detail: `status=${bad.status}` });
      const tok = await login("admin", "admin123");
      out.push({ name: "Admin login succeeds (admin/admin123)", passed: !!tok });
      if (tok) {
        const me = await http("/api/v1/auth/me", { headers: { Authorization: `Bearer ${tok}` } });
        out.push({ name: "GET /auth/me returns 200 with valid token", passed: me.status === 200, detail: `status=${me.status}` });
      }
      return out;
    },
  },
  {
    name: "Pricing Engine (5-tier)",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };
      const products = await http("/api/v1/products?limit=1", { headers });
      const pBody = products.body as { data?: unknown };
      const raw = pBody?.data;
      const items = (Array.isArray(raw)
        ? raw
        : (raw as { items?: unknown[] })?.items ?? []) as Array<{ id: string; variants?: Array<{ id?: string; variantId?: string }> }>;
      if (!items || items.length === 0) { out.push({ name: "Has at least one product", passed: false }); return out; }
      const prod = items[0]!;
      const variantId = prod.variants?.[0]?.variantId ?? prod.variants?.[0]?.id;
      const low = await http(`/api/v1/products/${prod.id}/price?qty=1&channel=POS&variantId=${variantId}`, { headers });
      const high = await http(`/api/v1/products/${prod.id}/price?qty=20&channel=POS&variantId=${variantId}`, { headers });
      out.push({ name: "Price endpoint returns 200 (low qty)", passed: low.status === 200, detail: `status=${low.status}` });
      out.push({ name: "Price endpoint returns 200 (high qty)", passed: high.status === 200, detail: `status=${high.status}` });
      const lowB = low.body as { data?: { resolutionReason?: string; bulkRateApplied?: boolean } };
      const highB = high.body as { data?: { resolutionReason?: string; bulkRateApplied?: boolean } };
      out.push({ name: "Response includes resolutionReason", passed: !!lowB?.data?.resolutionReason, detail: lowB?.data?.resolutionReason });
      out.push({ name: "qty>=10 triggers wholesale (bulkRateApplied=true)", passed: highB?.data?.bulkRateApplied === true });
      return out;
    },
  },
  {
    name: "Stock System (immutable ledger)",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };
      const lvl = await http("/api/v1/stock/levels", { headers });
      out.push({ name: "GET /stock/levels returns 200", passed: lvl.status === 200 });
      const led = await http("/api/v1/stock/ledger?limit=5", { headers });
      out.push({ name: "GET /stock/ledger returns 200", passed: led.status === 200 });
      const adj = await http("/api/v1/stock/adjust", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ qty: 1 }),
      });
      out.push({ name: "POST /stock/adjust without reason returns 4xx", passed: adj.status >= 400 && adj.status < 500, detail: `status=${adj.status}` });
      const ledRows = led.body as { data?: unknown[] };
      const row = Array.isArray(ledRows?.data) ? (ledRows.data[0] as { id?: string } | undefined) : undefined;
      const sid = row?.id ?? "ledger-row-id-test";
      const putR = await http(`/api/v1/stock/ledger/${sid}`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ qty: 9999 }) });
      out.push({ name: "PUT /stock/ledger/:id is rejected (immutable)", passed: putR.status >= 400, detail: `status=${putR.status}` });
      const delR = await http(`/api/v1/stock/ledger/${sid}`, { method: "DELETE", headers });
      out.push({ name: "DELETE /stock/ledger/:id is rejected (immutable)", passed: delR.status >= 400, detail: `status=${delR.status}` });
      const patchR = await http(`/api/v1/stock/ledger/${sid}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ qty: 9999 }) });
      out.push({ name: "PATCH /stock/ledger/:id is rejected (immutable)", passed: patchR.status >= 400, detail: `status=${patchR.status}` });
      return out;
    },
  },
  {
    name: "Customers, Suppliers, Agents",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };
      for (const ep of ["/api/v1/customers?limit=1", "/api/v1/suppliers?limit=1", "/api/v1/agents?limit=1"]) {
        const r = await http(ep, { headers });
        out.push({ name: `GET ${ep.split("?")[0]} returns 200`, passed: r.status === 200, detail: `status=${r.status}` });
      }
      return out;
    },
  },
  {
    name: "Estimates / Invoices / Coupons",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };
      for (const ep of ["/api/v1/estimates?limit=1", "/api/v1/invoices?limit=1", "/api/v1/coupons?limit=1"]) {
        const r = await http(ep, { headers });
        out.push({ name: `GET ${ep.split("?")[0]} returns 200`, passed: r.status === 200, detail: `status=${r.status}` });
      }
      const validate = await http("/api/v1/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "DEFINITELY_NOT_A_REAL_COUPON_X9", cartTotal: 1000, channel: "POS" }),
      });
      out.push({ name: "Coupon validate with bad code returns invalid (200 or 404)", passed: validate.status === 200 || validate.status === 404, detail: `status=${validate.status}` });
      return out;
    },
  },
  {
    name: "POS / Warehouse / Reports",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };
      for (const ep of ["/api/v1/pos/products?limit=1", "/api/v1/transfers?limit=1", "/api/v1/purchase-orders?limit=1"]) {
        const r = await http(ep, { headers });
        out.push({ name: `GET ${ep.split("?")[0]} returns 200`, passed: r.status === 200, detail: `status=${r.status}` });
      }
      const today = new Date().toISOString().slice(0, 10);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const sales = await http(`/api/v1/reports/sales?dateFrom=${monthAgo}&dateTo=${today}`, { headers });
      out.push({ name: "GET /reports/sales returns 200", passed: sales.status === 200, detail: `status=${sales.status}` });
      return out;
    },
  },
  {
    name: "Locations, Users & Settings (admin)",
    run: async () => {
      const out: Check[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) { out.push({ name: "Skipped — no token", passed: false }); return out; }
      const headers = { Authorization: `Bearer ${tok}` };

      const locs = await http("/api/v1/locations", { headers });
      out.push({ name: "GET /locations returns 200", passed: locs.status === 200, detail: `status=${locs.status}` });
      const locArr = (locs.body as { data?: unknown[] })?.data;
      out.push({
        name: "Locations seed has at least one entry",
        passed: Array.isArray(locArr) && locArr.length > 0,
        detail: `count=${Array.isArray(locArr) ? locArr.length : 0}`,
      });

      const usersNoAuth = await http("/api/v1/users");
      out.push({
        name: "GET /users without token returns 401 (admin-only)",
        passed: usersNoAuth.status === 401,
        detail: `status=${usersNoAuth.status}`,
      });
      const users = await http("/api/v1/users", { headers });
      out.push({ name: "GET /users returns 200 (admin)", passed: users.status === 200, detail: `status=${users.status}` });

      const company = await http("/api/v1/settings/company", { headers });
      out.push({ name: "GET /settings/company returns 200", passed: company.status === 200, detail: `status=${company.status}` });
      const cBody = JSON.stringify(company.body ?? "");
      out.push({
        name: "Company settings reference brand 'Rathinam'",
        passed: /Rathinam/i.test(cBody),
        detail: cBody.slice(0, 80),
      });

      const pricing = await http("/api/v1/settings/pricing", { headers });
      out.push({ name: "GET /settings/pricing returns 200", passed: pricing.status === 200, detail: `status=${pricing.status}` });
      const pricingData = (pricing.body as { data?: Record<string, unknown> })?.data ?? {};
      const taxRate = pricingData["taxRate"];
      out.push({
        name: "Pricing settings include GST taxRate (>0)",
        passed: typeof taxRate === "number" && taxRate > 0,
        detail: `taxRate=${String(taxRate)}`,
      });

      // End-to-end transfer flow: create → dispatch → receive
      if (Array.isArray(locArr) && locArr.length >= 2) {
        const products = await http("/api/v1/products?limit=1", { headers });
        const raw = (products.body as { data?: unknown })?.data;
        const items = (Array.isArray(raw) ? raw : (raw as { items?: any[] })?.items ?? []) as any[];
        const prod = items[0];
        const variantId = prod?.variants?.[0]?.id ?? prod?.variants?.[0]?.variantId;
        const fromId = (locArr[0] as { id: string }).id;
        const toId = (locArr[1] as { id: string }).id;
        if (prod && variantId) {
          const created = await http("/api/v1/transfers", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              fromLocationId: fromId,
              toLocationId: toId,
              items: [{ productId: prod.id, variantId, qty: 1 }],
              notes: "verifier round-trip",
            }),
          });
          const tBody = created.body as { data?: { id?: string } };
          const tid = tBody?.data?.id;
          out.push({
            name: "POST /transfers creates a draft transfer",
            passed: created.status === 201 && !!tid,
            detail: `status=${created.status}`,
          });
          if (tid) {
            const disp = await http(`/api/v1/transfers/${tid}/dispatch`, {
              method: "PUT",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            out.push({ name: "PUT /transfers/:id/dispatch returns 200", passed: disp.status === 200, detail: `status=${disp.status}` });
            // Read-back: confirm dispatch flipped status to "in_transit".
            const afterDispatch = await http(`/api/v1/transfers/${tid}`, { headers });
            const dispBody = afterDispatch.body as { data?: { status?: string } };
            const dispStatus = dispBody?.data?.status;
            out.push({
              name: "Transfer status is 'in_transit' after dispatch",
              passed: afterDispatch.status === 200 && dispStatus === "in_transit",
              detail: `status=${dispStatus}`,
            });
            const recv = await http(`/api/v1/transfers/${tid}/receive`, {
              method: "PUT",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                items: [{ productId: prod.id, variantId, receivedQty: 1 }],
              }),
            });
            out.push({ name: "PUT /transfers/:id/receive returns 200", passed: recv.status === 200, detail: `status=${recv.status}` });
            // Read-back: confirm receive flipped status to "received".
            const afterReceive = await http(`/api/v1/transfers/${tid}`, { headers });
            const recvBody = afterReceive.body as { data?: { status?: string } };
            const recvStatus = recvBody?.data?.status;
            out.push({
              name: "Transfer status is 'received' after receive",
              passed: afterReceive.status === 200 && recvStatus === "received",
              detail: `status=${recvStatus}`,
            });
          }

          // End-to-end PO flow: create → receive → assert RECEIVED status + IN ledger row
          const suppliers = await http("/api/v1/suppliers?limit=1", { headers });
          const supArr = (suppliers.body as { data?: Array<{ id: string }> })?.data ?? [];
          const supplierId = supArr[0]?.id;
          if (supplierId) {
            const poCreated = await http("/api/v1/purchase-orders", {
              method: "POST",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                supplierId,
                warehouseId: fromId,
                items: [{ productId: prod.id, variantId, orderedQty: 2, unitPrice: 100 }],
                expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                notes: "verifier PO round-trip",
              }),
            });
            const poBody = poCreated.body as { data?: { id?: string } };
            const poId = poBody?.data?.id;
            out.push({
              name: "POST /purchase-orders creates a draft PO",
              passed: poCreated.status === 201 && !!poId,
              detail: `status=${poCreated.status}`,
            });
            if (poId) {
              const poRecv = await http(`/api/v1/purchase-orders/${poId}/receive`, {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({
                  items: [{ productId: prod.id, variantId, receivedQty: 2 }],
                }),
              });
              out.push({
                name: "PUT /purchase-orders/:id/receive returns 200",
                passed: poRecv.status === 200,
                detail: `status=${poRecv.status}`,
              });
              const poAfter = await http(`/api/v1/purchase-orders/${poId}`, { headers });
              const poRow = (poAfter.body as { data?: { status?: string } })?.data;
              out.push({
                name: "PO status is 'received' after receiving",
                passed: poRow?.status === "received",
                detail: `status=${poRow?.status}`,
              });
              const ledger = await http(
                `/api/v1/stock/ledger?productId=${prod.id}&variantId=${encodeURIComponent(variantId)}&limit=20`,
                { headers },
              );
              const ledgerRows = (ledger.body as { data?: Array<{ refType?: string; refId?: string; type?: string }> })?.data ?? [];
              const inwardForPo = ledgerRows.some(
                (r) => r.refType === "PO" && r.refId === poId && r.type === "IN",
              );
              out.push({
                name: "Stock ledger has IN row for received PO",
                passed: inwardForPo,
                detail: inwardForPo ? "ok" : `no matching ledger row (rows=${ledgerRows.length})`,
              });
            }
          }
        }
      }
      return out;
    },
  },
  {
    name: "Public APIs (Website)",
    run: async () => {
      const out: Check[] = [];
      const pub = await http("/api/v1/products/public?limit=3");
      out.push({ name: "GET /products/public returns 200 (no auth)", passed: pub.status === 200 });
      const pubB = pub.body as { data?: unknown };
      const rawP = pubB?.data;
      const items = (Array.isArray(rawP)
        ? rawP
        : (rawP as { items?: unknown[] })?.items ?? []) as Array<Record<string, unknown>>;
      const noPurchase = items.every((p) => !("purchase" in p) && !("purchaseRate" in p) && !("purchaseCost" in p));
      out.push({ name: "Public products do NOT expose purchase rate", passed: noPurchase });
      const cp = await http("/api/v1/coupons/public");
      out.push({ name: "GET /coupons/public reachable", passed: cp.status === 200 || cp.status === 404 });
      return out;
    },
  },
];

export default function Verifier() {
  const [sections, setSections] = useState<Section[]>(
    SECTIONS.map((s) => ({ name: s.name, status: "pending", checks: [] })),
  );
  const [running, setRunning] = useState(false);

  const totalChecks = sections.reduce((acc, s) => acc + s.checks.length, 0);
  const passedChecks = sections.reduce((acc, s) => acc + s.checks.filter(c => c.passed).length, 0);
  const failedChecks = totalChecks - passedChecks;
  const completed = sections.filter(s => s.status === "done").length;
  const progress = SECTIONS.length > 0 ? (completed / SECTIONS.length) * 100 : 0;

  const runAll = async () => {
    setRunning(true);
    const next: Section[] = SECTIONS.map((s) => ({ name: s.name, status: "pending", checks: [] }));
    setSections([...next]);
    for (let i = 0; i < SECTIONS.length; i++) {
      next[i] = { ...next[i]!, status: "running" };
      setSections([...next]);
      try {
        const checks = await SECTIONS[i]!.run();
        next[i] = { ...next[i]!, status: "done", checks };
      } catch (err) {
        next[i] = { ...next[i]!, status: "done", checks: [{ name: "Section threw error", passed: false, detail: String(err) }] };
      }
      setSections([...next]);
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Verifier</h1>
            <p className="text-sm text-muted-foreground">
              End-to-end health checks for the entire stack.
            </p>
          </div>
        </div>
        <Button onClick={runAll} disabled={running} size="lg" data-testid="run-verifier">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {running ? "Running…" : "Run all checks"}
        </Button>
      </div>

      {totalChecks > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {passedChecks}/{totalChecks} checks passed
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />{passedChecks} pass
                </Badge>
                {failedChecks > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                    <XCircle className="h-3 w-3 mr-1" />{failedChecks} fail
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sections.map((s) => (
          <Card key={s.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {s.status === "done" && (s.checks.every(c => c.passed) ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />)}
                {s.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                {s.name}
                {s.status === "done" && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {s.checks.filter(c => c.passed).length}/{s.checks.length}
                  </span>
                )}
              </CardTitle>
              {s.status === "pending" && <CardDescription className="text-xs">Click "Run all checks" to start</CardDescription>}
            </CardHeader>
            {s.checks.length > 0 && (
              <CardContent>
                <ul className="space-y-2">
                  {s.checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" data-testid={`check-${s.name}-${i}`}>
                      {c.passed
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
                      <span className={c.passed ? "" : "text-red-600 dark:text-red-400"}>
                        {c.name}
                        {c.detail && <span className="text-muted-foreground text-xs ml-1.5">({c.detail})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">CLI version</p>
          <p>Run from the project root for the full coloured terminal report:</p>
          <pre className="mt-2 bg-background p-2 rounded border text-xs">pnpm --filter @workspace/scripts run verify</pre>
        </CardContent>
      </Card>
    </div>
  );
}
