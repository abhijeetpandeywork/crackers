import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetProduct, useUpdateProduct, useCreateProduct, type ProductVariant, type CreateProductBody } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const isNew = !id || id === "new";
  
  const { data: product, isLoading } = useGetProduct(id || "", {
    query: { enabled: !isNew, queryKey: ["product", id] }
  });
  
  const updateMutation = useUpdateProduct();
  const createMutation = useCreateProduct();
  
  const [formData, setFormData] = useState<CreateProductBody & { status: string }>({
    code: "",
    name: "",
    category: "Ground",
    description: "",
    hsnCode: "",
    onlineDisplay: true,
    status: "Active",
    variants: [] as ProductVariant[],
  });
  const [defaultBrand, setDefaultBrand] = useState<string>("Standard");

  const KNOWN_BRANDS = [
    "Standard",
    "Sri Kaliswari",
    "Cock Brand",
    "Ajantha",
    "Vinayaga",
    "Coronation",
    "Supreme",
  ];

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code || "",
        name: product.name || "",
        category: (product.category as string) || "Ground",
        description: product.description || "",
        hsnCode: product.hsnCode || "",
        onlineDisplay: product.onlineDisplay ?? true,
        status: (product.status as string) || "Active",
        variants: product.variants || []
      });
      const firstBrand = product.variants?.find(v => v.brand)?.brand;
      if (firstBrand) setDefaultBrand(firstBrand);
    }
  }, [product]);

  const handleSave = () => {
    if (isNew) {
      const { status: _status, ...createData } = formData;
      createMutation.mutate({
        data: createData
      }, {
        onSuccess: (res) => {
          toast({ title: "Product created successfully" });
          setLocation(`/products/${res?.id ?? ""}`);
        },
        onError: () => toast({ title: "Error creating product", variant: "destructive" })
      });
    } else {
      updateMutation.mutate({
        id: id!,
        data: formData,
      }, {
        onSuccess: () => toast({ title: "Product updated successfully" }),
        onError: () => toast({ title: "Error updating product", variant: "destructive" })
      });
    }
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        size: "",
        packContent: "",
        unit: "box",
        brand: defaultBrand || undefined,
        prices: {
          purchase: 0,
          wholesaleBulk: 0,
          retailOnline: 0,
          retailEst: 0,
          agent: 0
        }
      }]
    }));
  };

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index: number, field: string, value: unknown) => {
    setFormData(prev => {
      const newVariants = [...prev.variants];
      const keys = field.split('.');
      const variant = { ...newVariants[index] } as Record<string, unknown>;
      if (keys.length === 2) {
        const nested = { ...((variant[keys[0]] as Record<string, unknown>) ?? {}) };
        nested[keys[1]] = value;
        variant[keys[0]] = nested;
      } else {
        variant[field] = value;
      }
      newVariants[index] = variant as ProductVariant;
      return { ...prev, variants: newVariants };
    });
  };

  if (isLoading) return <Skeleton className="w-full h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/products")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h2 className="text-3xl font-bold">{isNew ? "New Product" : "Edit Product"}</h2>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
            {isNew ? "Create Product" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input 
                  value={formData.code} 
                  onChange={e => setFormData(p => ({...p, code: e.target.value}))} 
                  disabled={!isNew}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({...p, category: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ground">Ground</SelectItem>
                    <SelectItem value="Aerial">Aerial</SelectItem>
                    <SelectItem value="Sparkler">Sparkler</SelectItem>
                    <SelectItem value="Novelty">Novelty</SelectItem>
                    <SelectItem value="Gift Box">Gift Box</SelectItem>
                    <SelectItem value="Bundle">Bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>HSN Code</Label>
                <Input 
                  value={formData.hsnCode} 
                  onChange={e => setFormData(p => ({...p, hsnCode: e.target.value}))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Default Brand</Label>
                <Input
                  list="erp-brand-suggestions"
                  value={defaultBrand}
                  onChange={e => setDefaultBrand(e.target.value)}
                  placeholder="e.g. Standard, Sri Kaliswari"
                />
                <datalist id="erp-brand-suggestions">
                  {KNOWN_BRANDS.map(b => <option key={b} value={b} />)}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Pre-fills brand for new variants. Each variant can override.
                </p>
                {formData.variants.length > 0 && (() => {
                  const trimmed = defaultBrand.trim();
                  const blankCount = formData.variants.filter(v => !v.brand?.trim()).length;
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!trimmed || blankCount === 0}
                      onClick={() => setFormData(p => ({
                        ...p,
                        variants: p.variants.map(v => v.brand?.trim() ? v : { ...v, brand: trimmed })
                      }))}
                      title={!trimmed ? "Enter a default brand first" : blankCount === 0 ? "All variants already have a brand" : ""}
                    >
                      {blankCount === 0
                        ? "All variants have a brand"
                        : `Fill ${blankCount} variant${blankCount === 1 ? '' : 's'} without a brand`}
                    </Button>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between">
                <Label>Online Display</Label>
                <Switch 
                  checked={formData.onlineDisplay} 
                  onCheckedChange={v => setFormData(p => ({...p, onlineDisplay: v}))} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Variants & Pricing</CardTitle>
              <Button size="sm" onClick={addVariant}><Plus className="h-4 w-4 mr-2" /> Add Variant</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.variants.map((variant, i) => (
                <div key={i} className="p-4 border rounded-md relative bg-card/50">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" 
                    onClick={() => removeVariant(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pr-8">
                    <div className="space-y-2">
                      <Label>Size/Detail</Label>
                      <Input value={variant.size || ''} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="e.g. 5cm, 1000 wala" />
                    </div>
                    <div className="space-y-2">
                      <Label>Pack Content</Label>
                      <Input value={variant.packContent || ''} onChange={e => updateVariant(i, 'packContent', e.target.value)} placeholder="e.g. 10 pcs/box" />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input value={variant.unit || ''} onChange={e => updateVariant(i, 'unit', e.target.value)} placeholder="box, pkt" />
                    </div>
                    <div className="space-y-2">
                      <Label>Brand</Label>
                      <Input
                        list="erp-brand-suggestions"
                        value={variant.brand || ''}
                        onChange={e => updateVariant(i, 'brand', e.target.value || undefined)}
                        placeholder={defaultBrand || 'Standard'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Purchase Price</Label>
                      <Input type="number" value={variant.prices?.purchase || 0} onChange={e => updateVariant(i, 'prices.purchase', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Wholesale (Bulk)</Label>
                      <Input type="number" value={variant.prices?.wholesaleBulk || 0} onChange={e => updateVariant(i, 'prices.wholesaleBulk', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Retail Online</Label>
                      <Input type="number" value={variant.prices?.retailOnline || 0} onChange={e => updateVariant(i, 'prices.retailOnline', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Retail Est.</Label>
                      <Input type="number" value={variant.prices?.retailEst || 0} onChange={e => updateVariant(i, 'prices.retailEst', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Agent Price</Label>
                      <Input type="number" value={variant.prices?.agent || 0} onChange={e => updateVariant(i, 'prices.agent', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
              {formData.variants.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  No variants added. Add at least one variant for pricing.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
