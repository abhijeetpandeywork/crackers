import { useRoute, Link } from "wouter";
import {
  useGetTransfer,
  useDispatchTransfer,
  useReceiveTransfer,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, ArrowRightLeft, Send, PackageCheck, Truck, MapPin, FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TransferDetail() {
  const [, params] = useRoute("/transfers/:id");
  const id = params?.id ?? "";
  const { toast } = useToast();

  const { data, isLoading, refetch } = useGetTransfer(id, {
    query: { enabled: !!id },
  });
  const dispatchM = useDispatchTransfer();
  const receiveM = useReceiveTransfer();

  const t = (data as any)?.data;
  const items = (t?.items ?? []) as Array<any>;

  const statusBadge = (status: string) => {
    const label = (status ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    switch (status) {
      case "draft": return <Badge variant="outline">{label}</Badge>;
      case "pending_approval": return <Badge variant="secondary">{label}</Badge>;
      case "in_transit": return <Badge variant="default" className="bg-blue-500">{label}</Badge>;
      case "received": return <Badge variant="default" className="bg-green-500">{label}</Badge>;
      case "cancelled": return <Badge variant="destructive">{label}</Badge>;
      default: return <Badge variant="outline">{label || status}</Badge>;
    }
  };

  const handleDispatch = async () => {
    try {
      await dispatchM.mutateAsync({ transferId: id, data: {} });
      toast({ title: "Transfer dispatched" });
      refetch();
    } catch {
      toast({ title: "Dispatch failed", variant: "destructive" });
    }
  };

  const handleReceive = async () => {
    try {
      await receiveM.mutateAsync({
        transferId: id,
        data: {
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            receivedQty: i.qty,
          })),
        } as any,
      });
      toast({ title: "Transfer received" });
      refetch();
    } catch {
      toast({ title: "Receive failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!t) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/transfers"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Transfers</Link>
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Transfer not found.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/transfers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Transfer {t.transferNo ?? t.id?.slice(0, 8)}
            </h2>
            <p className="text-sm text-muted-foreground">
              Created {t.createdAt ? new Date(t.createdAt).toLocaleString("en-IN") : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(t.status)}
          {(t.status === "draft" || t.status === "pending_approval") && (
            <Button onClick={handleDispatch} disabled={dispatchM.isPending} data-testid="dispatch-btn">
              <Send className="mr-2 h-4 w-4" /> Dispatch
            </Button>
          )}
          {t.status === "in_transit" && (
            <Button onClick={handleReceive} disabled={receiveM.isPending} data-testid="receive-btn">
              <PackageCheck className="mr-2 h-4 w-4" /> Mark Received
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> From
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold">{t.fromLocationName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t.fromLocationId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> To
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold">{t.toLocationName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{t.toLocationId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" /> Movement
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Vehicle: <span className="font-medium">{t.vehicleNo ?? "—"}</span></p>
            <p>Dispatched: <span className="font-medium">{t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleString("en-IN") : "—"}</span></p>
            <p>Received: <span className="font-medium">{t.receivedAt ? new Date(t.receivedAt).toLocaleString("en-IN") : "—"}</span></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No items on this transfer.
                  </TableCell>
                </TableRow>
              ) : items.map((i, idx) => (
                <TableRow key={`${i.productId}-${i.variantId}-${idx}`}>
                  <TableCell className="font-medium">{i.productName ?? i.productId}</TableCell>
                  <TableCell>{i.variantLabel ?? i.variantId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.batchNo ?? "—"}</TableCell>
                  <TableCell className="text-right font-bold">{i.qty}</TableCell>
                  <TableCell className="text-right">{i.receivedQty ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {t.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{t.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
