import { useState } from "react";
import { useListPurchaseOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrdersList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const queryParams: any = { page, limit: 50 };
  if (search) queryParams.search = search;
  if (status !== "ALL") queryParams.status = status;

  const { data, isLoading } = useListPurchaseOrders(queryParams);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Draft": return <Badge variant="secondary">{status}</Badge>;
      case "Sent": return <Badge variant="default" className="bg-blue-500">{status}</Badge>;
      case "Received": return <Badge variant="default" className="bg-green-500">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Purchase Orders</h2>
          <p className="text-muted-foreground">Manage stock procurement from suppliers.</p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" /> New PO
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by PO # or supplier..."
            className="pl-9 w-full bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Received">Received</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-12 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  No purchase orders found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-sm">{po.poNumber || po.id.slice(0,8)}</TableCell>
                  <TableCell className="font-medium">{po.supplierName}</TableCell>
                  <TableCell>{new Date(po.createdAt).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>{po.itemsCount || po.items?.length || 0}</TableCell>
                  <TableCell>₹{po.totalAmount?.toLocaleString('en-IN')}</TableCell>
                  <TableCell>{getStatusBadge(po.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/purchase-orders/${po.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
