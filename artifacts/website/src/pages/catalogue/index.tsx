import { useState } from "react";
import { useLocation } from "wouter";
import { useListPublicProducts } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";

export default function Catalogue() {
  const [searchParams] = useLocation();
  const initialCategory = new URLSearchParams(window.location.search).get("category") || "All";
  
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListPublicProducts({
    search: search || undefined,
    category: category === "All" ? undefined : category,
    page,
    limit: 12
  });

  const products = data?.data || [];
  const totalPages = data?.meta?.pages || 1;

  const priceRange = (p: any): { min: number; max: number } => {
    const prices = (p?.variants ?? [])
      .map((v: any) => Number(v?.prices?.retailOnline))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };

  const categories = ["All", "Ground", "Aerial", "Sparkler", "Gift Box", "Bundle", "Novelty"];

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen pb-20">
        {/* Sticky Header */}
        <div className="sticky top-16 z-40 bg-white border-b border-gray-200 py-4 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-grow max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search products..." 
                  className="pl-10 h-11 bg-gray-50 border-gray-200 rounded-full"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              
              <Tabs value={category} onValueChange={(val) => {
                setCategory(val);
                setPage(1);
              }} className="w-full md:w-auto overflow-x-auto no-scrollbar">
                <TabsList className="bg-gray-100/50 p-1 h-11 rounded-full">
                  {categories.map(cat => (
                    <TabsTrigger 
                      key={cat} 
                      value={cat}
                      className="rounded-full px-6 data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm"
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-red-600 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Loading our fireworks collection...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <span className="text-6xl mb-4 block">🏮</span>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product: any) => (
                  <a 
                    key={product.id} 
                    href={`/product/${product.id}`}
                    className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col"
                  >
                    <div className="aspect-square bg-gradient-to-br from-red-50 to-amber-50 flex items-center justify-center relative overflow-hidden">
                      <span className="text-7xl group-hover:scale-110 transition-transform duration-500">
                        {product.category === 'Aerial' ? '🚀' : product.category === 'Gift Box' ? '🎁' : '🎇'}
                      </span>
                      <div className="absolute top-3 left-3">
                        <span className="bg-white/90 backdrop-blur-sm text-red-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm">
                          {product.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 flex-grow flex flex-col">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2 group-hover:text-red-600 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">Code: {product.code}</p>
                      <div className="mt-auto flex items-center justify-between">
                        {(() => {
                          const r = priceRange(product);
                          return (
                            <span className="text-lg font-bold text-gray-900">
                              {r.min === 0 && r.max === 0
                                ? "Price on call"
                                : r.min === r.max
                                  ? `₹${r.min.toLocaleString("en-IN")}`
                                  : `₹${r.min.toLocaleString("en-IN")} – ₹${r.max.toLocaleString("en-IN")}`}
                            </span>
                          );
                        })()}
                        <Button size="sm" variant="outline" className="rounded-full border-red-100 text-red-600 hover:bg-red-50 group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 transition-all">
                          View
                        </Button>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center space-x-4">
                  <Button 
                    variant="outline" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="rounded-full"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="rounded-full"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
