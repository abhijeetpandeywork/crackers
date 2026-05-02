import { useGetInvoice, useShareInvoice } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Share2, Download, Printer, IndianRupee, Building, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePdf, savePdf } from "@workspace/pdf";

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const { toast } = useToast();
  const { data, isLoading } = useGetInvoice(params?.id as string);
  const shareMutation = useShareInvoice();

  const handleShare = async () => {
    try {
      await shareMutation.mutateAsync({ invoiceId: params?.id as string });
      toast({ title: "Success", description: "Invoice shared successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to share invoice", variant: "destructive" });
    }
  };

  const handleDownloadPdf = () => {
    const inv = data?.data;
    if (!inv) return;
    const doc = generateInvoicePdf(inv as any);
    savePdf(doc, `invoice-${inv.invoiceNumber || inv.id.slice(0, 8)}`);
    toast({ title: "PDF downloaded" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const invoice = data?.data;
  if (!invoice) return <div>Invoice not found.</div>;

  const subtotal = invoice.items?.reduce((sum: number, item: any) => sum + (item.qty * item.unitPrice), 0) || 0;
  const cgst = invoice.taxAmount ? invoice.taxAmount / 2 : 0;
  const sgst = cgst;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invoice #{invoice.invoiceNumber || invoice.id.slice(0,8)}</h2>
            <div className="flex gap-2 mt-1">
              <Badge variant={invoice.paymentStatus === 'Paid' ? 'default' : 'destructive'}>
                {invoice.paymentStatus}
              </Badge>
              <Badge variant="outline">{invoice.channel}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} disabled={shareMutation.isPending}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button size="sm" onClick={handleDownloadPdf} data-testid="invoice-download-pdf">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" /> Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-bold text-lg">RATHINAM CRACKERS</div>
            <p>123 Factory Road, Sivakasi, Tamil Nadu</p>
            <p>GSTIN: 33AAAAA0000A1Z5</p>
            <p>Phone: +91 98765 43210</p>
            <p>Email: sales@rathinamcrackers.com</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-bold text-lg">{invoice.customerName}</div>
            <p>ID: {invoice.customerId}</p>
            {invoice.customerGstin && <p>GSTIN: {invoice.customerGstin}</p>}
            <p>Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.map((item: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.variantLabel}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">₹{item.unitPrice?.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right font-medium">₹{(item.qty * item.unitPrice)?.toLocaleString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-8 flex justify-end">
            <div className="w-full max-w-[300px] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CGST (9%):</span>
                <span>₹{cgst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-muted-foreground">SGST (9%):</span>
                <span>₹{sgst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2">
                <span>Grand Total:</span>
                <span className="text-primary">₹{invoice.totalAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
