import { useState, useEffect } from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Building2, Store, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function LocationsList() {
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch("/api/v1/locations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLocations(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load locations", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      type: formData.get("type"),
      city: formData.get("city"),
      phone: formData.get("phone"),
      address: formData.get("address"),
    };

    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch("/api/v1/locations", {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: "Success", description: "Location created successfully" });
        setIsDialogOpen(false);
        fetchLocations();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create location", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Business Locations</h2>
          <p className="text-muted-foreground">Manage warehouses and retail outlet points.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select name="type" defaultValue="SHOP">
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                      <SelectItem value="SHOP">Retail Shop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="city" className="text-right">City</Label>
                  <Input id="city" name="city" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" name="phone" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">Address</Label>
                  <Input id="address" name="address" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Location</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ))
            ) : locations.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No locations found.</TableCell></TableRow>
            ) : (
              locations.map((loc: any) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {loc.type === 'WAREHOUSE' ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <Store className="h-4 w-4 text-primary" />}
                      {loc.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={loc.type === 'WAREHOUSE' ? 'secondary' : 'outline'}>
                      {loc.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{loc.city}</TableCell>
                  <TableCell>{loc.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={loc.active ? 'default' : 'secondary'}>
                      {loc.active ? 'Active' : 'Inactive'}
                    </Badge>
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
