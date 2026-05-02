import { useGetOutstandingReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle } from "lucide-react";

export default function OutstandingReport() {
  const { data, isLoading } = useGetOutstandingReport();
  const items = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Outstanding Report</h2>
          <p className="text-muted-foreground">Monitor unpaid balances and credit exposure.</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Receivables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Outstanding Amount</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Overdue Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No outstanding payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.customerName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.customerType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        ₹{item.outstandingAmount?.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        {item.lastPaymentDate ? new Date(item.lastPaymentDate).toLocaleDateString('en-IN') : 'None'}
                      </TableCell>
                      <TableCell>
                        <span className={item.overdueDays > 30 ? "text-destructive font-bold" : ""}>
                          {item.overdueDays} days
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.overdueDays > 60 ? (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Critical
                          </Badge>
                        ) : item.overdueDays > 30 ? (
                          <Badge variant="secondary" className="bg-amber-500 text-white">Warning</Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
