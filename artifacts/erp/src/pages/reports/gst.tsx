import { useState } from "react";
import { useGetGstReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, FileText, IndianRupee, Download } from "lucide-react";
import { generateReportPdf, savePdf } from "@workspace/pdf";

export default function GstReport() {
  const [month, setMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(() => new Date().getFullYear().toString());

  const period = `${year}-${month.padStart(2, '0')}`;
  const { data, isLoading } = useGetGstReport({ period });

  const report = data?.data as any;
  const summaryDisplay = report?.summary ?? {};
  const hsnRowsDisplay: any[] = report?.hsnTable ?? report?.b2b ?? report?.b2c ?? [];

  const handleExportPdf = () => {
    const r = report as any;
    const s = r?.summary ?? {};
    // GST route may expose either a typed hsnTable or generic b2b/b2c rows.
    const hsnRows: any[] = r?.hsnTable ?? r?.b2b ?? r?.b2c ?? [];
    const doc = generateReportPdf({
      title: "GST Report",
      subtitle: `Filing period: ${period}`,
      period,
      summary: [
        { label: "Taxable Value", value: `Rs. ${(Number(s.totalTaxable) || 0).toLocaleString("en-IN")}` },
        { label: "CGST (9%)", value: `Rs. ${(Number(s.totalCgst) || 0).toLocaleString("en-IN")}` },
        { label: "SGST (9%)", value: `Rs. ${(Number(s.totalSgst) || 0).toLocaleString("en-IN")}` },
        { label: "Total GST", value: `Rs. ${(Number(s.totalGst) || 0).toLocaleString("en-IN")}` },
      ],
      columns: ["HSN Code", "Description", "Qty", "Taxable Value (Rs.)", "GST Rate (%)", "Tax Amount (Rs.)"],
      rows: hsnRows.map((row: any) => [
        row.hsnCode ?? "-",
        row.description ?? "-",
        Number(row.totalQty) || 0,
        Number(row.taxableValue) || 0,
        Number(row.gstRate) || 0,
        Number(row.taxAmount) || 0,
      ]),
      footerNote: `GSTIN-bound HSN summary for ${period}`,
    });
    savePdf(doc, `gst-report-${period}`);
  };

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
          <Button variant="outline" size="sm" className="h-9" onClick={handleExportPdf} disabled={isLoading} data-testid="gst-export-pdf">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Taxable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{(Number(summaryDisplay.totalTaxable) || 0).toLocaleString('en-IN')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">CGST (9%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{(Number(summaryDisplay.totalCgst) || 0).toLocaleString('en-IN')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">SGST (9%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₹{(Number(summaryDisplay.totalSgst) || 0).toLocaleString('en-IN')}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Total GST</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{(Number(summaryDisplay.totalGst) || 0).toLocaleString('en-IN')}</div>
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
                ) : hsnRowsDisplay.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                ) : (
                  hsnRowsDisplay.map((item: any, i: number) => (
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
