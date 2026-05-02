import React from "react";
import { useLocation, useSearch } from "wouter";
import { useGetInvoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Printer, ShoppingBag, ChevronRight, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateInvoicePdf, savePdf } from "@workspace/pdf";

const ReceiptScreen = () => {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const invoiceId = params.get("id");

  const { data: invoiceData, isLoading } = useGetInvoice(invoiceId || "");

  const handleNewSale = () => {
    setLocation("/sale");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!invoice) return;
    const doc = generateInvoicePdf(invoice as any);
    savePdf(doc, `invoice-${invoice.invoiceNumber || invoiceId?.slice(0, 8) || "receipt"}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const invoice = invoiceData?.invoice;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0d0d0d]">
      <div className="w-full max-w-lg animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="h-24 w-24 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-black">SALE COMPLETE</h1>
          <p className="text-zinc-500 mt-2">Invoice #{invoice?.invoiceNumber || invoiceId?.slice(0, 8)}</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 text-white mb-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-zinc-500 uppercase font-black">Customer</p>
                  <p className="text-xl font-bold">{invoice?.customerName || "Walk-in Customer"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 uppercase font-black">Amount</p>
                  <p className="text-3xl font-black text-primary">₹{invoice?.totalAmount?.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="p-6 space-y-4">
                {invoice?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <p className="font-bold">{item.productName}</p>
                      <p className="text-zinc-500">{item.variantLabel} x {item.quantity}</p>
                    </div>
                    <p className="font-black">₹{item.lineTotal?.toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-500 uppercase font-black">Payment Method</p>
                <p className="font-bold">{invoice?.paymentMethod || "CASH"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500 uppercase font-black">Date</p>
                <p className="font-bold">{new Date(invoice?.createdAt || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-16 text-base font-bold border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
            onClick={handlePrint}
          >
            <Printer className="mr-2 h-5 w-5" /> PRINT
          </Button>
          <Button
            variant="outline"
            className="h-16 text-base font-bold border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
            onClick={handleDownloadPdf}
            disabled={!invoice}
            data-testid="receipt-download-pdf"
          >
            <Download className="mr-2 h-5 w-5" /> PDF
          </Button>
          <Button
            className="h-16 text-base font-bold"
            onClick={handleNewSale}
          >
            NEW SALE <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        
        <div className="mt-8 text-center">
          <Button variant="link" className="text-zinc-500 hover:text-primary" onClick={() => setLocation("/sale")}>
            <ShoppingBag className="mr-2 h-4 w-4" /> Back to Sale Screen
          </Button>
        </div>
      </div>

      {/* Print Overlay (Hidden on Screen) */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-mono">
        <div className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">RATHINAM CRACKERS</h1>
          <p>Sivakasi, Tamil Nadu</p>
          <p>GSTIN: 33XXXXXXXXXXXXX</p>
        </div>
        <div className="flex justify-between mb-4">
          <div>
            <p>Invoice: {invoice?.invoiceNumber}</p>
            <p>Date: {new Date(invoice?.createdAt || Date.now()).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p>Customer: {invoice?.customerName || "Walk-in"}</p>
          </div>
        </div>
        <table className="w-full mb-4 border-b">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Item</th>
              <th className="text-center py-2">Qty</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.items?.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className="py-1">{item.productName} ({item.variantLabel})</td>
                <td className="text-center py-1">{item.quantity}</td>
                <td className="text-right py-1">{item.unitPrice}</td>
                <td className="text-right py-1">{item.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-col items-end">
          <p>Subtotal: ₹{invoice?.subtotalAmount}</p>
          <p>GST (18%): ₹{invoice?.taxAmount}</p>
          <p className="text-xl font-bold">Total: ₹{invoice?.totalAmount}</p>
        </div>
        <div className="mt-8 text-center text-xs">
          <p>Thank you for shopping with us!</p>
          <p>Visit again!</p>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScreen;
