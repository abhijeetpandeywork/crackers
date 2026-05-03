import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useListPublicProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/cart";
import {
  ChevronLeft,
  ShoppingCart,
  ShieldCheck,
  Info,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Award,
  Sparkles,
  Phone,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";

const categoryEmoji = (cat?: string) => {
  switch (cat) {
    case "Aerial": return "🚀";
    case "Gift Box": return "🎁";
    case "Sparkler": return "✨";
    case "Ground": return "🎆";
    case "Novelty": return "🎇";
    case "Bundle": return "📦";
    default: return "🎇";
  }
};

const formatPrice = (n: number) =>
  Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "Price on call";

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [qty, setQty] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const { data: publicProducts, isLoading } = useListPublicProducts({ limit: 500 });

  const product = useMemo(() => {
    return publicProducts?.data?.find((p: any) => p.id === id);
  }, [publicProducts, id]);

  // Group variants by brand. brand is optional → fallback "Standard".
  const brandGroups = useMemo(() => {
    if (!product?.variants?.length) return [] as Array<{ brand: string; variants: any[] }>;
    const map = new Map<string, any[]>();
    for (const v of product.variants) {
      const b = v.brand || "Standard";
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(v);
    }
    return Array.from(map.entries()).map(([brand, variants]) => ({ brand, variants }));
  }, [product]);

  const isMultiBrand = brandGroups.length > 1;

  // Reset brand/variant/image when product id changes (e.g., navigating via Related Products).
  useEffect(() => {
    setSelectedBrand(null);
    setSelectedVariantId(null);
    setActiveImage(0);
    setQty(1);
  }, [id]);

  // Initialise / re-validate brand once product loads or brand groups change.
  useEffect(() => {
    if (brandGroups.length === 0) return;
    const exists = selectedBrand && brandGroups.some((g) => g.brand === selectedBrand);
    if (!exists) {
      setSelectedBrand(brandGroups[0].brand);
    }
  }, [brandGroups, selectedBrand]);

  const visibleVariants = useMemo(() => {
    if (!selectedBrand) return product?.variants ?? [];
    return brandGroups.find((g) => g.brand === selectedBrand)?.variants ?? [];
  }, [brandGroups, selectedBrand, product]);

  const selectedVariant: any = useMemo(() => {
    if (!visibleVariants?.length) return null;
    if (selectedVariantId) {
      const found = visibleVariants.find((v: any) => v.variantId === selectedVariantId);
      if (found) return found;
    }
    return visibleVariants[0];
  }, [visibleVariants, selectedVariantId]);

  // Reset variant selection when brand changes.
  useEffect(() => {
    setSelectedVariantId(null);
  }, [selectedBrand]);

  // Related products — same category, exclude current.
  const related = useMemo(() => {
    if (!product || !publicProducts?.data) return [];
    return publicProducts.data
      .filter((p: any) => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }, [publicProducts, product]);

  const variantLabel = (v: any) => {
    const parts = [v?.brand, v?.size, v?.packContent].filter(Boolean);
    return parts.join(" · ") || "Standard";
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;

    const unitPrice = Number(selectedVariant.prices?.retailOnline) || 0;
    if (unitPrice <= 0) {
      toast({
        title: "Price unavailable",
        description: "Please call us on +91 98765 43210 to confirm pricing.",
        variant: "destructive",
      });
      return;
    }

    addItem({
      productId: product.id ?? "",
      variantId: selectedVariant.variantId ?? "",
      productName: product.name ?? "Product",
      variantLabel: variantLabel(selectedVariant),
      qty,
      unitPrice,
    });

    toast({
      title: "Added to cart",
      description: `${qty} × ${product.name} (${variantLabel(selectedVariant)}) added.`,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500">Discovering product details...</p>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-8">The product you're looking for doesn't exist or has been removed.</p>
          <Link href="/catalogue">
            <Button className="bg-red-600">Back to Catalogue</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const emoji = categoryEmoji(product.category);
  const galleryFrames = [emoji, "🎆", "✨", "🎇"];
  const onlinePrice = Number(selectedVariant?.prices?.retailOnline) || 0;
  const estPrice = Number(selectedVariant?.prices?.retailEst) || 0;
  const discount = estPrice > onlinePrice && onlinePrice > 0
    ? Math.round(((estPrice - onlinePrice) / estPrice) * 100)
    : 0;

  // Compute the "from" price for each brand chip (smallest size).
  const brandStartingPrice = (brand: string) => {
    const variants = brandGroups.find((g) => g.brand === brand)?.variants ?? [];
    const prices = variants
      .map((v: any) => Number(v.prices?.retailOnline) || 0)
      .filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : 0;
  };

  return (
    <Layout>
      <div className="bg-white pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-500 mb-8" data-testid="breadcrumb">
            <Link href="/" className="hover:text-red-600 transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/catalogue" className="hover:text-red-600 transition-colors">Catalogue</Link>
            <span className="mx-2">/</span>
            <span className="hover:text-red-600 transition-colors">{product.category}</span>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium truncate">{product.name}</span>
          </nav>

          <Link href="/catalogue" className="inline-flex items-center text-sm text-gray-500 hover:text-red-600 mb-6 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Catalogue
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* ---------- Gallery ---------- */}
            <div>
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-red-500/10 via-amber-500/10 to-yellow-300/10 flex items-center justify-center relative overflow-hidden group">
                <span
                  key={activeImage}
                  className="text-[12rem] transform group-hover:scale-110 transition-transform duration-700 animate-in fade-in zoom-in"
                  data-testid="product-hero-image"
                >
                  {galleryFrames[activeImage]}
                </span>
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <Badge className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border-none">
                    {product.category}
                  </Badge>
                  {(product as any).featured && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border-none">
                      <Sparkles className="h-3 w-3 mr-1" /> Featured
                    </Badge>
                  )}
                </div>
                {discount > 0 && (
                  <div className="absolute top-6 right-6">
                    <Badge className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border-none">
                      {discount}% OFF
                    </Badge>
                  </div>
                )}
              </div>
              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {galleryFrames.map((frame, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-3xl transition-all ${
                      activeImage === idx
                        ? "bg-red-50 border-2 border-red-600"
                        : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
                    }`}
                    data-testid={`thumbnail-${idx}`}
                  >
                    {frame}
                  </button>
                ))}
              </div>
            </div>

            {/* ---------- Info ---------- */}
            <div className="flex flex-col">
              <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3" data-testid="product-name">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Info className="h-4 w-4 mr-1 text-amber-500" />
                    HSN: {product.hsnCode}
                  </span>
                  <span className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                    SKU: {product.code}
                  </span>
                  {isMultiBrand && (
                    <span className="flex items-center">
                      <Award className="h-4 w-4 mr-1 text-red-600" />
                      {brandGroups.length} brands available
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-gray-600 leading-relaxed">
                  Experience the magic of authentic Sivakasi fireworks. This {(product.category ?? "cracker").toLowerCase()} is hand-crafted by master artisans
                  and inspected for safety before leaving our warehouse. Perfect for Diwali, weddings, festivals and special celebrations.
                </p>
              </div>

              {/* ---------- Brand selector (only if multi-brand) ---------- */}
              {isMultiBrand && (
                <div className="mb-8" data-testid="brand-selector">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center">
                    <Award className="h-4 w-4 mr-2 text-red-600" /> Choose Brand
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {brandGroups.map(({ brand }) => {
                      const isActive = brand === selectedBrand;
                      const startPrice = brandStartingPrice(brand);
                      return (
                        <button
                          key={brand}
                          onClick={() => setSelectedBrand(brand)}
                          className={`px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                            isActive
                              ? "border-red-600 bg-red-50"
                              : "border-gray-100 bg-gray-50 hover:border-gray-200"
                          }`}
                          data-testid={`brand-${brand.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          <span className={`block text-sm font-bold ${isActive ? "text-red-600" : "text-gray-900"}`}>
                            {brand}
                          </span>
                          <span className="block text-[11px] text-gray-500 mt-0.5">
                            from {formatPrice(startPrice)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---------- Variants ---------- */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">
                  {isMultiBrand ? `${selectedBrand} — Select Size` : "Select Variant"}
                </h3>
                <div className="flex flex-wrap gap-3" data-testid="variant-selector">
                  {visibleVariants.map((v: any, idx: number) => {
                    const isActive =
                      selectedVariantId === v.variantId ||
                      (!selectedVariantId && idx === 0);
                    return (
                      <button
                        key={v.variantId ?? idx}
                        onClick={() => setSelectedVariantId(v.variantId ?? null)}
                        className={`px-6 py-3 rounded-2xl border-2 transition-all text-sm font-bold text-left min-w-[110px] ${
                          isActive
                            ? "border-red-600 bg-red-50 text-red-600"
                            : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                        }`}
                        data-testid={`variant-${v.variantId}`}
                      >
                        <span className="block">{v.size ?? "Standard"}</span>
                        {v.packContent && (
                          <span className="block text-[10px] font-semibold opacity-70 mt-0.5">
                            {v.packContent}
                          </span>
                        )}
                        <span className="block text-[11px] font-semibold mt-1">
                          {formatPrice(Number(v.prices?.retailOnline) || 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ---------- Price & Qty ---------- */}
              {selectedVariant && (
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-6 sm:p-8 mb-8 border border-gray-100 shadow-sm" data-testid="price-card">
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">
                        Online price · per {selectedVariant.unit?.toLowerCase() ?? "unit"}
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-extrabold text-gray-900" data-testid="selected-price">
                          {formatPrice(onlinePrice)}
                        </span>
                        {estPrice > onlinePrice && (
                          <span className="text-lg text-gray-400 line-through">
                            {formatPrice(estPrice)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Inclusive of all taxes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-tighter">Contents</p>
                      <p className="font-bold text-gray-700">{selectedVariant.packContent ?? "1 Pack"}</p>
                      {selectedVariant.brand && (
                        <p className="text-xs text-red-600 font-semibold mt-1">{selectedVariant.brand}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600"
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        data-testid="qty-decrement"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 border-none text-center font-bold text-lg focus-visible:ring-0"
                        data-testid="qty-input"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600"
                        onClick={() => setQty(qty + 1)}
                        data-testid="qty-increment"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      className="flex-grow h-14 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-lg shadow-lg shadow-red-900/10"
                      onClick={handleAddToCart}
                      data-testid="add-to-cart"
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                    </Button>
                  </div>

                  {onlinePrice > 0 && (
                    <p className="text-sm text-gray-500 mt-4">
                      Total: <span className="font-bold text-gray-900">{formatPrice(onlinePrice * qty)}</span>
                      {qty > 1 && <span className="text-xs ml-1">({qty} × {formatPrice(onlinePrice)})</span>}
                    </p>
                  )}
                </div>
              )}

              {/* ---------- Trust strip ---------- */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-t border-gray-100">
                <div className="flex flex-col items-center text-center">
                  <ShieldCheck className="h-6 w-6 text-green-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe & Legal</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <CheckCircle2 className="h-6 w-6 text-amber-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">100% Original</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <Truck className="h-6 w-6 text-blue-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pan-India Delivery</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <Package className="h-6 w-6 text-red-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Secure Packaging</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Specs / Safety panels ---------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
            <div className="rounded-3xl border border-gray-100 bg-gray-50/50 p-8" data-testid="specs-panel">
              <h3 className="text-lg font-extrabold text-gray-900 mb-4 flex items-center">
                <Info className="h-5 w-5 mr-2 text-red-600" /> Product Specifications
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Category</dt>
                  <dd className="font-semibold text-gray-900">{product.category}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">SKU Code</dt>
                  <dd className="font-semibold text-gray-900">{product.code}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">HSN Code</dt>
                  <dd className="font-semibold text-gray-900">{product.hsnCode}</dd>
                </div>
                {selectedVariant?.brand && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Selected Brand</dt>
                    <dd className="font-semibold text-gray-900">{selectedVariant.brand}</dd>
                  </div>
                )}
                {selectedVariant?.size && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Size</dt>
                    <dd className="font-semibold text-gray-900">{selectedVariant.size}</dd>
                  </div>
                )}
                {selectedVariant?.packContent && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">Pack Content</dt>
                    <dd className="font-semibold text-gray-900">{selectedVariant.packContent}</dd>
                  </div>
                )}
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Origin</dt>
                  <dd className="font-semibold text-gray-900">Sivakasi, Tamil Nadu</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Variants</dt>
                  <dd className="font-semibold text-gray-900">{product.variants?.length ?? 0}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-8" data-testid="safety-panel">
              <h3 className="text-lg font-extrabold text-gray-900 mb-4 flex items-center">
                <ShieldCheck className="h-5 w-5 mr-2 text-amber-600" /> Safety Guidelines
              </h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Always light fireworks under adult supervision in open spaces.</li>
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Keep a bucket of water and sand nearby while bursting crackers.</li>
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Do not relight a "dud" cracker — wait 20 minutes and soak in water.</li>
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Store fireworks in a cool, dry place away from heat sources.</li>
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Wear cotton clothing and protective eyewear when handling.</li>
                <li className="flex"><span className="text-amber-600 mr-2 font-bold">•</span>Read PESO/CCOE manufacturer instructions before use.</li>
              </ul>
              <div className="mt-6 pt-4 border-t border-amber-100 flex items-center text-xs text-gray-600">
                <Phone className="h-4 w-4 mr-2 text-red-600" />
                Questions? Call us at <a href="tel:+919876543210" className="font-bold text-red-600 ml-1">+91 98765 43210</a>
              </div>
            </div>
          </div>

          {/* ---------- Related products ---------- */}
          {related.length > 0 && (
            <div className="mt-16" data-testid="related-products">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">You may also like</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {related.map((rp: any) => {
                  const startPrice = (rp.variants ?? [])
                    .map((v: any) => Number(v.prices?.retailOnline) || 0)
                    .filter((n: number) => n > 0)
                    .reduce((min: number, n: number) => (min === 0 || n < min ? n : min), 0);
                  return (
                    <Link
                      key={rp.id}
                      href={`/product/${rp.id}`}
                      className="group rounded-2xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all overflow-hidden bg-white"
                      data-testid={`related-${rp.id}`}
                    >
                      <div className="aspect-square bg-gradient-to-br from-red-500/10 to-amber-500/10 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform">
                        {categoryEmoji(rp.category)}
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1">{rp.category}</p>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">{rp.name}</h3>
                        <p className="text-sm font-extrabold text-gray-900">{formatPrice(startPrice)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
