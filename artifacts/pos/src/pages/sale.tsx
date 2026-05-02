import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  useGetPosProducts, 
  useHoldBill, 
  useListHeldBills, 
  useValidateCoupon, 
  usePosCreateSale,
  useCloseShift
} from "@workspace/api-client-react";
import { useCart } from "@/context/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Pause, 
  History, 
  LogOut, 
  CheckCircle2,
  ChevronRight,
  User,
  HelpCircle
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

const categories = ["All", "Ground", "Aerial", "Sparkler", "Gift Box", "Bundle"];

const SaleScreen = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  
  const { 
    items, addItem, removeItem, updateQty, clearCart, 
    subtotal, gst, discount, total, 
    coupon, applyCoupon, customer, setCustomer 
  } = useCart();
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: productsData, isLoading: loadingProducts } = useGetPosProducts({ 
    locationId: "loc1", // required
  });

  const { mutate: holdBill } = useHoldBill();
  const { data: heldBillsResponse } = useListHeldBills({
    locationId: "loc1"
  });
  const { mutate: validateCoupon, isPending: validatingCoupon } = useValidateCoupon();
  const { mutate: createSale, isPending: checkingOut } = usePosCreateSale();
  const { mutate: closeShift } = useCloseShift();

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    validateCoupon(
      { data: { code: couponCode, cartTotal: subtotal } },
      {
        onSuccess: (res) => {
          if (res.data?.valid) {
            applyCoupon({
              code: couponCode,
              type: 'PERCENT', // Defaulting to PERCENT for now as Coupon type is complex in schema
              value: res.data.discountAmount || 0,
            });
            toast({ title: "Coupon applied successfully" });
          } else {
            toast({ title: res.data?.error || "Invalid coupon", variant: "destructive" });
          }
        },
        onError: () => {
          toast({ title: "Error validating coupon", variant: "destructive" });
        }
      }
    );
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }

    const saleData = {
      items: items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty
      })),
      paymentMode: paymentMethod,
      locationId: "loc1", // required
      couponCode: coupon?.code,
      customerId: customer?.id
    };

    createSale(
      { data: saleData },
      {
        onSuccess: (res) => {
          // Navigate to receipt
          if (res.data?.invoice?.id) {
            setLocation(`/receipt?id=${res.data.invoice.id}`);
          }
        },
        onError: (err) => {
          toast({ title: "Checkout failed", description: (err as any).message, variant: "destructive" });
        }
      }
    );
  };

  const handleHoldBill = () => {
    if (items.length === 0) return;
    holdBill(
      { 
        data: { 
          locationId: "loc1",
          items: items.map(i => ({
            productId: i.productId,
            variantId: i.variantId,
            qty: i.qty
          })) 
        } 
      },
      {
        onSuccess: () => {
          clearCart();
          toast({ title: "Bill held successfully" });
        }
      }
    );
  };

  const handleCloseShift = () => {
    closeShift(
      { data: { shiftId: "shift1", closingCash: 0 } },
      {
        onSuccess: () => {
          localStorage.removeItem("pos_token");
          setLocation("/");
          toast({ title: "Shift closed" });
        }
      }
    );
  };

  const change = paymentMethod === "CASH" ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;

  const products = productsData?.data || [];
  const heldBills = heldBillsResponse?.data || [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d]">
      {/* Left Panel: Products */}
      <div className="w-[60%] flex flex-col border-r border-zinc-800">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
              <Input 
                placeholder="Search products (Code or Name)..." 
                className="pl-10 h-14 bg-zinc-900 border-zinc-800 text-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="h-14 w-14 border-zinc-800" onClick={handleCloseShift}>
              <LogOut className="h-6 w-6 text-red-500" />
            </Button>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-zinc-900 w-full justify-start overflow-x-auto p-1 h-auto">
              {categories.map(cat => (
                <TabsTrigger 
                  key={cat} 
                  value={cat} 
                  className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {products.map((product: any) => (
              <Card key={product.id} className="bg-zinc-900 border-zinc-800 overflow-hidden hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-4">
                     <span className="text-zinc-600 font-bold text-4xl">{product.code}</span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold truncate text-lg">{product.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.variants?.map((variant: any) => (
                        <Button 
                          key={variant.id}
                          variant="secondary" 
                          size="sm"
                          className="text-xs h-9 bg-zinc-800 hover:bg-primary hover:text-white"
                          onClick={() => addItem({
                            productId: product.id,
                            variantId: variant.id,
                            productName: product.name,
                            variantLabel: variant.label,
                            qty: 1,
                            unitPrice: variant.price || 0
                          })}
                        >
                          {variant.label} • ₹{variant.price}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-[40%] flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black">CART</h2>
            <Badge variant="outline" className="text-primary border-primary">{items.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="border-zinc-800">
                  <History className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-zinc-950 border-zinc-800 text-white w-[400px]">
                <SheetHeader>
                  <SheetTitle className="text-white text-2xl font-black">HELD BILLS</SheetTitle>
                </SheetHeader>
                <div className="mt-8 space-y-4">
                  {heldBills.map((bill: any) => (
                    <div key={bill.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold">Bill #{bill.id.slice(0,8)}</p>
                        <p className="text-xs text-zinc-500">{new Date(bill.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <Button size="sm">Resume</Button>
                    </div>
                  ))}
                  {!heldBills.length && <p className="text-center text-zinc-600 py-8">No held bills</p>}
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="icon" className="border-zinc-800 text-amber-500" onClick={handleHoldBill}>
              <Pause className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="border-zinc-800 text-red-500" onClick={clearCart}>
              <Trash2 className="h-5 w-5" />
            </Button>
            <Link href="/help">
              <Button variant="outline" size="icon" className="border-zinc-800 text-blue-400" data-testid="pos-help-link">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-900">
                <div className="flex-1">
                  <h4 className="font-bold text-lg leading-none">{item.productName}</h4>
                  <p className="text-sm text-zinc-500 mt-1">{item.variantLabel}</p>
                  <p className="text-primary font-bold mt-1">₹{item.unitPrice.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-md">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-black text-lg">₹{item.lineTotal.toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                <Trash2 className="h-16 w-16 mb-4 opacity-10" />
                <p className="text-xl font-bold">Cart is empty</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Coupon Code" 
              className="h-12 bg-zinc-950 border-zinc-800" 
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <Button variant="secondary" className="h-12 px-6" onClick={handleApplyCoupon} disabled={validatingCoupon}>
              APPLY
            </Button>
          </div>

          <div className="space-y-2 text-zinc-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Discount</span>
                <span>- ₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>GST (18%)</span>
              <span>₹{gst.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-white text-3xl font-black pt-2 border-t border-zinc-800">
              <span>TOTAL</span>
              <span className="text-primary">₹{Math.round(total).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2">
            {(["CASH", "CARD", "UPI"] as const).map(method => (
              <Button
                key={method}
                variant={paymentMethod === method ? "default" : "outline"}
                className={`h-16 text-lg font-bold border-zinc-800 ${paymentMethod === method ? "bg-primary text-white" : "bg-zinc-950"}`}
                onClick={() => setPaymentMethod(method)}
              >
                {method}
              </Button>
            ))}
          </div>

          {paymentMethod === "CASH" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 uppercase font-black">Cash Received</label>
                  <Input 
                    type="number" 
                    className="h-14 text-2xl font-black bg-zinc-950 border-zinc-800"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500 uppercase font-black">Change</label>
                  <div className="h-14 text-2xl font-black flex items-center justify-end pr-4 bg-zinc-950 border border-zinc-800 rounded-md text-green-500">
                    ₹{change.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Button 
            className="w-full h-20 text-2xl font-black rounded-xl shadow-lg shadow-primary/20"
            disabled={items.length === 0 || (paymentMethod === "CASH" && (parseFloat(cashReceived) || 0) < total) || checkingOut}
            onClick={handleCheckout}
          >
            {checkingOut ? "PROCESSING..." : "CHECKOUT"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SaleScreen;
