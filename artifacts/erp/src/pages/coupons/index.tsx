import { useState } from "react";
import { useListCoupons, useUpdateCoupon, useCreateCoupon } from "@workspace/api-client-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Tags, Calendar, Percent, IndianRupee, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function CouponsList() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useListCoupons();
  const updateMutation = useUpdateCoupon();
  const createMutation = useCreateCoupon();

  const handleToggleActive = async (coupon: any) => {
    try {
      const isActive = coupon.status === 'active';
      await updateMutation.mutateAsync({
        id: coupon.id,
        data: { status: isActive ? 'paused' : 'active' }
      });
      toast({ title: "Success", description: `Coupon ${!isActive ? 'activated' : 'deactivated'}` });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update coupon status", variant: "destructive" });
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validFromRaw = formData.get("validFrom") as string;
    const validUntilRaw = formData.get("expiryDate") as string;
    const payload = {
      code: formData.get("code") as string,
      type: formData.get("type") as string,
      discountValue: parseFloat(formData.get("value") as string) || 0,
      minOrderValue: parseFloat(formData.get("minOrderAmount") as string) || 0,
      usageLimit: parseInt(formData.get("maxUses") as string) || undefined,
      validFrom: validFromRaw || new Date().toISOString().slice(0, 10),
      validUntil: validUntilRaw || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };

    try {
      await createMutation.mutateAsync({ data: payload });
      toast({ title: "Success", description: "Coupon created successfully" });
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create coupon", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Coupons & Offers</h2>
          <p className="text-muted-foreground">Manage discounts and promotional codes.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create New Discount Coupon</DialogTitle>
                <DialogDescription>Define a coupon code, discount type, and validity window for customer orders.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Code</Label>
                  <Input id="code" name="code" placeholder="NEWYEAR2025" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select name="type" defaultValue="PERCENT">
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                      <SelectItem value="FLAT">Flat Amount (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="value" className="text-right">Value</Label>
                  <Input id="value" name="value" type="number" step="0.01" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="minOrderAmount" className="text-right">Min Order</Label>
                  <Input id="minOrderAmount" name="minOrderAmount" type="number" className="col-span-3" defaultValue="0" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="maxUses" className="text-right">Max Uses</Label>
                  <Input id="maxUses" name="maxUses" type="number" className="col-span-3" placeholder="Leave empty for unlimited" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="expiryDate" className="text-right">Expiry</Label>
                  <Input id="expiryDate" name="expiryDate" type="date" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Coupon
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by coupon code..."
          className="pl-9 w-full bg-background"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Min Order</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                </TableRow>
              ))
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                  No coupons found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((coupon: any) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tags className="h-3 w-3 text-primary" />
                      <span className="font-bold font-mono">{coupon.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{coupon.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {coupon.type === 'PERCENT' ? `${coupon.value}%` : `₹${coupon.value}`}
                  </TableCell>
                  <TableCell>₹{coupon.minOrderAmount?.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <span className="text-xs">
                      {coupon.usedCount || 0} / {coupon.maxUses || '∞'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('en-IN') : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={coupon.status === 'active'} 
                      onCheckedChange={() => handleToggleActive(coupon)}
                      disabled={updateMutation.isPending}
                    />
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
