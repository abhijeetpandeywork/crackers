import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useListPublicProducts, useGetProduct } from "@workspace/api-client-react";
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
  AlertCircle
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Fallback pattern as per instructions
  const { data: directProduct, isLoading: isLoadingDirect, isError: isErrorDirect } = useGetProduct(id!);
  const { data: publicProducts, isLoading: isLoadingPublic } = useListPublicProducts({ limit: 100 });

  const product = useMemo(() => {
    if (directProduct?.data) return directProduct.data;
    return publicProducts?.data?.find((p: any) => p.id === id);
  }, [directProduct, publicProducts, id]);

  const isLoading = isLoadingDirect || isLoadingPublic;

  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    if (selectedVariantId) return product.variants.find((v: any) => v.id === selectedVariantId);
    return product.variants[0];
  }, [product, selectedVariantId]);

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      productName: product.name,
      variantLabel: selectedVariant.label,
      qty,
      unitPrice: selectedVariant.price?.retailOnline || 0
    });

    toast({
      title: "Added to cart",
      description: `${qty} x ${product.name} (${selectedVariant.label}) added.`,
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

  return (
    <Layout>
      <div className="bg-white pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/catalogue" className="inline-flex items-center text-sm text-gray-500 hover:text-red-600 mb-8 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Catalogue
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Product Image */}
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-red-500/10 to-amber-500/10 flex items-center justify-center relative overflow-hidden group">
              <span className="text-9xl transform group-hover:scale-110 transition-transform duration-700">
                {product.category === 'Aerial' ? '🚀' : product.category === 'Gift Box' ? '🎁' : '🎇'}
              </span>
              <div className="absolute top-6 left-6">
                <Badge className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border-none">
                  {product.category}
                </Badge>
              </div>
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Info className="h-4 w-4 mr-1 text-amber-500" />
                    HSN: {product.hsnCode}
                  </span>
                  <span className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                    SKU: {product.code}
                  </span>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-gray-600 leading-relaxed italic">
                  Experience the magic of authentic Sivakasi fireworks. This {product.category.toLowerCase()} is perfect for making your celebrations unforgettable. 
                  All our products follow strict safety guidelines.
                </p>
              </div>

              {/* Variants */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Select Variant</h3>
                <div className="flex flex-wrap gap-3">
                  {product.variants?.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-6 py-3 rounded-2xl border-2 transition-all text-sm font-bold ${
                        (selectedVariantId === v.id || (!selectedVariantId && product.variants[0].id === v.id))
                          ? "border-red-600 bg-red-50 text-red-600"
                          : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price & Qty */}
              {selectedVariant && (
                <div className="bg-gray-50 rounded-3xl p-8 mb-8 border border-gray-100">
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Price per unit</p>
                      <span className="text-4xl font-extrabold text-gray-900">₹{selectedVariant.price?.retailOnline || 0}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-tighter">Contents</p>
                      <p className="font-bold text-gray-700">{selectedVariant.contents || '1 Pack'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600"
                        onClick={() => setQty(Math.max(1, qty - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input 
                        type="number" 
                        value={qty} 
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 border-none text-center font-bold text-lg focus-visible:ring-0"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-10 w-10 hover:bg-gray-100 text-gray-600"
                        onClick={() => setQty(qty + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button 
                      className="flex-grow h-14 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-lg shadow-lg shadow-red-900/10"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
                    </Button>
                  </div>
                </div>
              )}

              {/* Trust Badge */}
              <div className="flex items-center justify-center space-x-8 py-6 border-t border-gray-100">
                <div className="flex flex-col items-center">
                  <ShieldCheck className="h-6 w-6 text-green-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Safe & Legal</span>
                </div>
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="h-6 w-6 text-amber-500 mb-2" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">100% Original</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
