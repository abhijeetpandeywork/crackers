import { Link } from "wouter";
import { useListPublicProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Star, ShieldCheck, Truck, Award } from "lucide-react";
import { Layout } from "@/components/layout";

export default function Home() {
  const { data: featuredData, isLoading } = useListPublicProducts({ featured: true, limit: 6 });
  const products = featuredData?.data || [];

  const categories = [
    { name: "Ground", emoji: "🎇", color: "from-orange-500 to-red-600" },
    { name: "Aerial", emoji: "🚀", color: "from-blue-500 to-indigo-600" },
    { name: "Sparkler", emoji: "✨", color: "from-yellow-400 to-amber-600" },
    { name: "Gift Box", emoji: "🎁", color: "from-purple-500 to-pink-600" },
    { name: "Bundle", emoji: "📦", color: "from-green-500 to-teal-600" },
    { name: "Novelty", emoji: "🎭", color: "from-cyan-500 to-blue-600" },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a0a00_0%,#4a1000_50%,#8b2500_100%)]" />
        {/* Simple CSS Sparkles */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-1 h-1 bg-amber-200 rounded-full animate-pulse"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight">
            Celebrate with <span className="text-amber-400">Rathinam Crackers</span>
          </h1>
          <p className="text-xl md:text-2xl text-amber-100/90 mb-10 max-w-3xl mx-auto font-medium">
            Premium Sivakasi Fireworks Since 1985. Making every festival extraordinary with safety and brilliance.
          </p>
          <Link href="/catalogue">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-red-950 font-bold text-lg px-10 h-14 rounded-full shadow-xl shadow-amber-900/20">
              Shop Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Collection</h2>
              <p className="text-gray-600">Our hand-picked favorites for this season</p>
            </div>
            <Link href="/catalogue">
              <Button variant="ghost" className="text-red-600 hover:text-red-700 font-semibold">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex overflow-x-auto pb-8 gap-6 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="min-w-[280px] h-[350px] bg-gray-100 rounded-2xl animate-pulse" />
              ))
            ) : (
              products.map((product: any) => (
                <Link key={product.id} href={`/product/${product.id}`}>
                  <Card className="min-w-[280px] group cursor-pointer border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-gray-50">
                    <CardContent className="p-0">
                      <div className="aspect-[4/5] bg-gradient-to-br from-red-100 to-amber-100 flex items-center justify-center relative">
                        <span className="text-6xl transform group-hover:scale-110 transition-transform duration-300">🎆</span>
                        <div className="absolute top-3 left-3">
                          <span className="bg-white/90 backdrop-blur-sm text-red-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                            {product.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                        <p className="text-red-600 font-bold">₹{product.priceRange?.min || 0}+</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link key={cat.name} href={`/catalogue?category=${cat.name}`}>
                <div className="group cursor-pointer">
                  <div className={`aspect-square rounded-3xl bg-gradient-to-br ${cat.color} flex flex-col items-center justify-center p-6 text-white shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300`}>
                    <span className="text-4xl mb-3">{cat.emoji}</span>
                    <span className="font-bold text-sm uppercase tracking-widest">{cat.name}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6">
                <Award className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Premium Quality</h3>
              <p className="text-gray-600">Sourced directly from the finest manufacturers in Sivakasi with rigorous quality checks.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-6">
                <Truck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">Pan-India Delivery</h3>
              <p className="text-gray-600">Safely transporting joy to every corner of India with specialized logistics partners.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-6">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-3">GST Invoice Included</h3>
              <p className="text-gray-600">100% legal and transparent transactions with valid GST billing for every purchase.</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
