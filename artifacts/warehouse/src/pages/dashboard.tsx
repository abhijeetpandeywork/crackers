import { useGetStockLedger, useGetStockLevels, useListPendingTransfers, useListPurchaseOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowDownToLine, 
  ArrowLeftRight, 
  Settings2, 
  History, 
  AlertCircle, 
  ArrowUpRight,
  ClipboardList,
  PackageCheck
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Dashboard() {
  const { data: stockLevels } = useGetStockLevels({});
  const { data: pendingTransfers } = useListPendingTransfers({});
  const { data: pendingPOs } = useListPurchaseOrders({ status: "Sent" });
  const { data: ledgerEntries } = useGetStockLedger({ limit: 10 });

  const lowStockCount = stockLevels?.data.filter(s => (s.quantity || 0) <= (s.reorderLevel || 0)).length || 0;
  const pendingTransferCount = pendingTransfers?.data.length || 0;
  const pendingPOCount = pendingPOs?.data.length || 0;

  const quickActions = [
    { label: "Receive Stock", icon: ArrowDownToLine, href: "/receive", color: "bg-teal-500" },
    { label: "New Transfer", icon: ArrowLeftRight, href: "/transfers/new", color: "bg-blue-500" },
    { label: "Stock Adjust", icon: Settings2, href: "/adjust", color: "bg-amber-500" },
    { label: "View Ledger", icon: History, href: "/ledger", color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Warehouse Dashboard</h1>
        <p className="text-muted-foreground">Overview of current stock operations and pending tasks.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className={`h-4 w-4 ${lowStockCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Items below reorder level</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTransferCount}</div>
            <p className="text-xs text-muted-foreground">Internal stock movements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPOCount}</div>
            <p className="text-xs text-muted-foreground">Purchase orders to receive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Active warehouses/shops</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <a className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                <div className={`p-3 rounded-full ${action.color} text-white mb-3 group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="font-medium text-gray-900">{action.label}</span>
              </a>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerEntries?.data.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      entry.type === 'INWARD' ? 'default' : 
                      entry.type === 'OUTWARD' ? 'destructive' : 
                      'outline'
                    } className="text-[10px] px-1.5 py-0">
                      {entry.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {entry.productName}
                    <div className="text-xs text-muted-foreground">{entry.variantName}</div>
                  </TableCell>
                  <TableCell>{entry.locationName}</TableCell>
                  <TableCell className={`text-right font-semibold ${entry.quantityChange > 0 ? "text-green-600" : "text-red-600"}`}>
                    {entry.quantityChange > 0 ? "+" : ""}{entry.quantityChange}
                  </TableCell>
                </TableRow>
              ))}
              {(!ledgerEntries?.data || ledgerEntries.data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No recent ledger entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Warehouse({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 22H2V10l10-8 10 8v12Z" />
      <path d="M6 14v4" />
      <path d="M10 14v4" />
      <path d="M14 14v4" />
      <path d="M18 14v4" />
    </svg>
  );
}
