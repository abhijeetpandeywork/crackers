import { useState } from "react";
import { 
  useGetCustomer, 
  useGetCustomerStatement, 
  useGetCustomerLoyalty,
  useRecordCustomerPayment
} from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Phone, Mail, MapPin, Building, Wallet, Star, Loader2, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const { toast } = useToast();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const customerId = params?.id as string;
  const { data: customer, isLoading: loadingCustomer } = useGetCustomer(customerId);
  const { data: statementData, isLoading: loadingStatement, refetch: refetchStatement } = useGetCustomerStatement(customerId);
  const { data: loyaltyData, isLoading: loadingLoyalty } = useGetCustomerLoyalty(customerId);
  
  const paymentMutation = useRecordCustomerPayment();

  const handlePayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);

    try {
      await paymentMutation.mutateAsync({
        id: customerId,
        data: {
          amount,
          date: new Date().toISOString().slice(0, 10),
          reference: formData.get("reference") as string,
        }
      });
      toast({ title: "Success", description: "Payment recorded successfully" });
      setIsPaymentDialogOpen(false);
      refetchStatement();
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    }
  };

  if (loadingCustomer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid gap-6 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!customer) return <div>Customer not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{customer.name}</h2>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{customer.customerType}</Badge>
              {customer.gstin && <Badge variant="outline">GSTIN: {customer.gstin}</Badge>}
            </div>
          </div>
        </div>
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wallet className="mr-2 h-4 w-4" /> Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handlePayment}>
              <DialogHeader>
                <DialogTitle>Record Customer Payment</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">Amount</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="method" className="text-right">Method</Label>
                  <Select name="method" defaultValue="CASH">
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="reference" className="text-right">Reference</Label>
                  <Input id="reference" name="reference" placeholder="TXN ID, Cheque #" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={paymentMutation.isPending}>
                  {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(customer.outstandingBalance ?? 0) > 0 ? "text-destructive" : "text-green-600"}`}>
              ₹{customer.outstandingBalance?.toLocaleString('en-IN') || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Loyalty Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loyaltyData?.data?.totalPoints || 0}
            </div>
            <p className="text-[10px] text-muted-foreground">Entries: {loyaltyData?.data?.entries?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Credit Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{customer.creditLimit?.toLocaleString('en-IN') || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">City / Region</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.city || 'Sivakasi'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{customer.city}, India</span>
            </div>
            {customer.gstin && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>GSTIN: {customer.gstin}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStatement ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : statementData?.data?.entries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  statementData?.data?.entries?.map((entry: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(entry.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium uppercase">{entry.type}</span>
                        <div className="text-[10px] text-muted-foreground">{entry.description}</div>
                      </TableCell>
                      <TableCell className="text-right">{entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '-'}</TableCell>
                      <TableCell className="text-right">{entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '-'}</TableCell>
                      <TableCell className="text-right font-medium">₹{entry.balance.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
