import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetProduct, useUpdateProduct, useCreateProduct, useListBrands, useGetSiteContent, type ProductVariant, type CreateProductBody, type Brand } from "@workspace/api-client-react";
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
  
  const [formData, setFormData] = useState<CreateProductBody & { status: string; occasions: string[] }>({
    code: "",
    name: "",
    category: "Ground",
    description: "",
    hsnCode: "",
    onlineDisplay: true,
    status: "Active",
    variants: [] as ProductVariant[],
    occasions: [],
  });
  const [defaultBrand, setDefaultBrand] = useState<string>("Standard");

  const { data: brandsResp } = useListBrands();
  const brands: Brand[] = (brandsResp?.data ?? []) as Brand[];

  // Occasion catalogue is CMS-driven (Site Content → Occasions).
  const { data: siteContentResp } = useGetSiteContent();
  const cmsOccasions = (((siteContentResp?.data ?? {}) as Record<string, unknown>)["occasions"] ?? []) as Array<{ key: string; label: string; emoji?: string }>;
  const toggleOccasion = (key: string) => {
    setFormData((p) => {
      const set = new Set(p.occasions ?? []);
      if (set.has(key)) set.delete(key); else set.add(key);
      return { ...p, occasions: Array.from(set) };
    });
  };
  const activeBrands = brands.filter((b) => b.isActive !== false);
  const brandNames = activeBrands.map((b) => b.name ?? "").filter(Boolean) as string[];
  // Always include the currently-selected brand even if inactive/missing.
  const ensureName = (n: string) => (n && !brandNames.includes(n) ? [n, ...brandNames] : brandNames);

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
        variants: product.variants || [],
        occasions: ((product as { occasions?: string[] }).occasions ?? []),
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
                <Select value={defaultBrand} onValueChange={setDefaultBrand}>
                  <SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger>
                  <SelectContent>
                    {ensureName(defaultBrand).map(b => (
                      <SelectItem key={b} value={b}>
                        <span className="flex items-center gap-2">
                          {(() => {
                            const found = brands.find(x => x.name === b);
                            return found?.logoUrl ? (
                              <img src={found.logoUrl} alt="" className="h-4 w-4 object-contain bg-white rounded-sm" />
                            ) : null;
                          })()}
                          {b}
                        </span>
                      </SelectItem>
                    ))}
                    {brandNames.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        No brands defined yet. Add brands under "Brands" in the sidebar.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pre-fills brand for new variants. Each variant can override.
                </p>
                {formData.variants.length > 0 && (() => {
                  const trimmed = defaultBrand.trim();
                  const blankCount = formData.variants.filter(v => !v.brand?.trim()).length;
                  const totalCount = formData.variants.length;
                  return (
                    <div className="space-y-2">
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
                        title={!trimmed ? "Pick a default brand first" : blankCount === 0 ? "All variants already have a brand" : ""}
                      >
                        {blankCount === 0
                          ? "All variants have a brand"
                          : `Fill ${blankCount} variant${blankCount === 1 ? '' : 's'} without a brand`}
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="w-full"
                        disabled={!trimmed}
                        onClick={() => {
                          if (!confirm(`Overwrite the brand on all ${totalCount} variant${totalCount === 1 ? '' : 's'} with "${trimmed}"?`)) return;
                          setFormData(p => ({
                            ...p,
                            variants: p.variants.map(v => ({ ...v, brand: trimmed }))
                          }));
                        }}
                        data-testid="btn-apply-brand-all"
                      >
                        Apply "{trimmed || '…'}" to ALL variants
                      </Button>
                    </div>
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

              <div className="space-y-2" data-testid="product-occasions">
                <Label>Occasions</Label>
                <p className="text-xs text-muted-foreground">
                  Tag this product with the celebrations it suits — customers can filter by these on the website.
                  Manage the list under <strong>Website Content → Occasions</strong>.
                </p>
                {cmsOccasions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No occasions defined yet. Add some in Website Content first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cmsOccasions.map((o) => {
                      const selected = (formData.occasions ?? []).includes(o.key);
                      return (
                        <button
                          key={o.key}
                          type="button"
                          data-testid={`occasion-toggle-${o.key}`}
                          onClick={() => toggleOccasion(o.key)}
                          className={`inline-flex items-center gap-1 px-3 h-8 rounded-full border text-xs font-medium transition ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-accent border-input"
                          }`}
                        >
                          {o.emoji && <span>{o.emoji}</span>}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                      <Select
                        value={variant.brand || ''}
                        onValueChange={(v) => updateVariant(i, 'brand', v || undefined)}
                      >
                        <SelectTrigger><SelectValue placeholder={defaultBrand || 'Select brand'} /></SelectTrigger>
                        <SelectContent>
                          {ensureName(variant.brand || '').filter(Boolean).map(b => (
                            <SelectItem key={b} value={b}>
                              <span className="flex items-center gap-2">
                                {(() => {
                                  const found = brands.find(x => x.name === b);
                                  return found?.logoUrl ? (
                                    <img src={found.logoUrl} alt="" className="h-4 w-4 object-contain bg-white rounded-sm" />
                                  ) : null;
                                })()}
                                {b}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
