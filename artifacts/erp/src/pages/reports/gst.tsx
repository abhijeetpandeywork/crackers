import { useState } from "react";
import { useGetGstReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, FileText, IndianRupee } from "lucide-react";

export default function GstReport() {
  const [month, setMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(() => new Date().getFullYear().toString());

  const period = `${year}-${month.padStart(2, '0')}`;
  const { data, isLoading } = useGetGstReport({ period });

  const report = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">GST Report</h2>
          <p className="text-muted-foreground">Tax filing and compliance overview.</p>
        </div>
        <div className="flex gap-4 items-center bg-card p-2 rounded-lg border">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {['2024', '2025', '2026'].map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Taxable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{report?.summary?.totalTaxable?.toLocaleString('en-IN') || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">CGST (9%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{report?.summary?.totalCgst?.toLocaleString('en-IN') || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">SGST (9%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{report?.summary?.totalSgst?.toLocaleString('en-IN') || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Total GST</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{report?.summary?.totalGst?.toLocaleString('en-IN') || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HSN-wise Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">GST Rate</TableHead>
                  <TableHead className="text-right">Tax Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                  ))
                ) : report?.hsnTable?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                ) : (
                  report?.hsnTable?.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{item.hsnCode}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.totalQty}</TableCell>
                      <TableCell className="text-right">₹{item.taxableValue?.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">{item.gstRate}%</TableCell>
                      <TableCell className="text-right font-medium">₹{item.taxAmount?.toLocaleString('en-IN')}</TableCell>
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
