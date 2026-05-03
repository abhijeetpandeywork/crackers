import { useGetInvoice, useShareInvoice, useGetCompanySettings } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Share2, Download, Printer, IndianRupee, Building, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePdf, savePdf, type CompanyInfo } from "@workspace/pdf";
import { resolveCompanyInfo } from "@/lib/company-info";

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const { toast } = useToast();
  const { data: invoice, isLoading } = useGetInvoice(params?.id as string);
  const { data: companyData } = useGetCompanySettings();
  const company: CompanyInfo = resolveCompanyInfo(companyData);
  const shareMutation = useShareInvoice();

  const handleShare = async () => {
    try {
      await shareMutation.mutateAsync({ id: params?.id as string });
      toast({ title: "Success", description: "Invoice shared successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to share invoice", variant: "destructive" });
    }
  };

  const handleDownloadPdf = () => {
    if (!invoice) return;
    const doc = generateInvoicePdf(invoice, company);
    savePdf(doc, `invoice-${invoice.invoiceNo || invoice.id?.slice(0, 8)}`);
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

  if (!invoice) return <div>Invoice not found.</div>;

  const subtotal = invoice.subtotal ?? 0;
  const cgst = invoice.cgst ?? 0;
  const sgst = invoice.sgst ?? 0;

  return (
    <div className="space-y-6 print-area">
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{company.name}</h1>
        {company.address && <p className="text-sm">{company.address}</p>}
        {company.gstin && <p className="text-sm">GSTIN: {company.gstin}</p>}
        {(company.phone || company.email) && (
          <p className="text-sm">{[company.phone, company.email].filter(Boolean).join(" | ")}</p>
        )}
        <hr className="my-3" />
        <h2 className="text-xl font-bold">TAX INVOICE</h2>
        <p className="text-sm">
          # {invoice.invoiceNo || invoice.id?.slice(0, 8)} &nbsp;|&nbsp; Date: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-IN") : "—"}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invoice #{invoice.invoiceNo || invoice.id?.slice(0,8)}</h2>
            <div className="flex gap-2 mt-1">
              <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'}>
                {invoice.status}
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
            <div className="font-bold text-lg">{company.name}</div>
            {company.address && <p>{company.address}</p>}
            {company.gstin && <p>GSTIN: {company.gstin}</p>}
            {company.phone && <p>Phone: {company.phone}</p>}
            {company.email && <p>Email: {company.email}</p>}
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
            <p>Date: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : ''}</p>
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
              {invoice.items?.map((item, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{item.variantSize}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">₹{item.resolvedPrice?.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right font-medium">₹{item.amount?.toLocaleString('en-IN')}</TableCell>
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
                <span className="text-primary">₹{invoice.total?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:grid grid-cols-2 gap-12 mt-16 text-sm">
        <div>
          <div className="border-t pt-2">Customer Signature</div>
        </div>
        <div>
          <div className="border-t pt-2">Authorized Signatory — {company.name}</div>
        </div>
      </div>
    </div>
  );
}
