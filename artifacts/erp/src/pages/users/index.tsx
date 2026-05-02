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
import { Plus, Users, UserCog, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch("/api/v1/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (user: any) => {
    try {
      const token = localStorage.getItem("erp_token");
      await fetch(`/api/v1/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !user.active })
      });
      toast({ title: "Success", description: "User status updated" });
      fetchUsers();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      username: formData.get("username"),
      role: formData.get("role"),
      password: formData.get("password"),
    };

    try {
      const token = localStorage.getItem("erp_token");
      const res = await fetch("/api/v1/users", {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: "Success", description: "User created successfully" });
        setIsDialogOpen(false);
        fetchUsers();
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN": return <Badge variant="destructive">{role}</Badge>;
      case "ERP_MANAGER": return <Badge variant="default">{role}</Badge>;
      case "CASHIER": return <Badge variant="secondary">{role}</Badge>;
      case "WH_MANAGER": return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">{role}</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Users</h2>
          <p className="text-muted-foreground">Manage employees and system access permissions.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add New Employee User</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">Username</Label>
                  <Input id="username" name="username" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Role</Label>
                  <Select name="role" defaultValue="CASHIER">
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      <SelectItem value="ERP_MANAGER">ERP Manager</SelectItem>
                      <SelectItem value="CASHIER">Cashier (POS)</SelectItem>
                      <SelectItem value="WH_MANAGER">Warehouse Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">Password</Label>
                  <Input id="password" name="password" type="password" className="col-span-3" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
            ) : (
              users.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={user.active} 
                      onCheckedChange={() => handleToggleActive(user)} 
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
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
