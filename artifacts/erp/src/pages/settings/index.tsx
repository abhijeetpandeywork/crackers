import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building, IndianRupee, Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("company");
  const [company, setCompany] = useState<any>({});
  const [pricing, setPricing] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("erp_token");
      const [compRes, priceRes] = await Promise.all([
        fetch("/api/v1/settings/company", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/settings/pricing", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const compData = await compRes.json();
      const priceData = await priceRes.json();
      setCompany(compData.data || {});
      setPricing(priceData.data || {});
    } catch (err) {
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("erp_token");
      await fetch("/api/v1/settings/company", {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(company)
      });
      toast({ title: "Success", description: "Company settings updated" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("erp_token");
      await fetch("/api/v1/settings/pricing", {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pricing)
      });
      toast({ title: "Success", description: "Pricing settings updated" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
        <p className="text-muted-foreground">Configure your business identity and application rules.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building className="h-4 w-4" /> Company Profile
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Pricing & Tax
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <form onSubmit={handleSaveCompany}>
            <Card>
              <CardHeader>
                <CardTitle>Business Identity</CardTitle>
                <CardDescription>This information appears on invoices and reports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input 
                      value={company.name || ''} 
                      onChange={(e) => setCompany({ ...company, name: e.target.value })} 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input 
                      value={company.gstin || ''} 
                      onChange={(e) => setCompany({ ...company, gstin: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email" 
                      value={company.email || ''} 
                      onChange={(e) => setCompany({ ...company, email: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={company.phone || ''} 
                      onChange={(e) => setCompany({ ...company, phone: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Registered Address</Label>
                  <Textarea 
                    value={company.address || ''} 
                    onChange={(e) => setCompany({ ...company, address: e.target.value })} 
                  />
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-bold mb-4">Bank Details (For Invoices)</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input 
                        value={company.bankName || ''} 
                        onChange={(e) => setCompany({ ...company, bankName: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input 
                        value={company.accountNumber || ''} 
                        onChange={(e) => setCompany({ ...company, accountNumber: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IFSC Code</Label>
                      <Input 
                        value={company.ifscCode || ''} 
                        onChange={(e) => setCompany({ ...company, ifscCode: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="pricing">
          <form onSubmit={handleSavePricing}>
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Loyalty Rules</CardTitle>
                <CardDescription>Global configuration for automated price discovery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold">Price Tiers</h4>
                    <div className="space-y-2">
                      <Label>Wholesale Qty Threshold</Label>
                      <Input 
                        type="number" 
                        value={pricing.wholesaleThreshold || 50} 
                        onChange={(e) => setPricing({ ...pricing, wholesaleThreshold: parseInt(e.target.value) })}
                      />
                      <p className="text-[10px] text-muted-foreground">Orders above this qty per item qualify for wholesale rates.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold">Tax & Loyalty</h4>
                    <div className="space-y-2">
                      <Label>Default GST Rate (%)</Label>
                      <Input 
                        type="number" 
                        value={pricing.defaultGstRate || 18} 
                        onChange={(e) => setPricing({ ...pricing, defaultGstRate: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loyalty Earn Rate (per ₹100)</Label>
                      <Input 
                        type="number" 
                        value={pricing.loyaltyEarnRate || 1} 
                        onChange={(e) => setPricing({ ...pricing, loyaltyEarnRate: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Software Version</span>
                <span className="font-mono">v1.2.4-stable</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Last Database Backup</span>
                <span>2 hours ago</span>
              </div>
              <div className="pt-4">
                <Button variant="outline" className="text-destructive border-destructive">Clear System Cache</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
