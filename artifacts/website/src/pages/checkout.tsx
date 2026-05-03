import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/context/cart";
import { useShopAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Truck, ShieldCheck, ChevronLeft, MapPin, Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import {
  useListShopAddresses,
  useCreateShopAddress,
  usePlaceShopOrder,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_ADDR = { label: "Home", name: "", phone: "", line1: "", line2: "", city: "", state: "Tamil Nadu", pincode: "", landmark: "", isDefault: true };

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { isLoggedIn, customer } = useShopAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: addrResp, refetch: refetchAddr } = useListShopAddresses({ query: { enabled: isLoggedIn } as any });
  const createAddr = useCreateShopAddress();
  const placeOrder = usePlaceShopOrder();

  const addresses = ((addrResp as any)?.data ?? []) as any[];
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState(EMPTY_ADDR);
  const [paymentMode, setPaymentMode] = useState<"COD" | "UPI" | "BANK">("COD");
  const [notes, setNotes] = useState("");
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`);
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (addresses.length && !selectedAddr) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      setSelectedAddr(def.id);
    }
    if (addresses.length === 0 && isLoggedIn) {
      setShowNewAddr(true);
      if (customer) setNewAddr((p) => ({ ...p, name: customer.name, phone: customer.phone }));
    }
  }, [addresses, selectedAddr, isLoggedIn, customer]);

  const handlePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    let addressId = selectedAddr;
    try {
      if (showNewAddr || !addressId) {
        const res = await createAddr.mutateAsync({ data: newAddr as any });
        addressId = (res as any).data.id;
        await refetchAddr();
      }
      const orderItems = items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }));
      const res = await placeOrder.mutateAsync({
        data: { items: orderItems, addressId: addressId!, paymentMode, notes: notes || undefined },
      });
      setPlacedOrder((res as any).data);
      clearCart();
    } catch (e: any) {
      toast({ title: "Could not place order", description: e?.data?.error?.message || "Try again.", variant: "destructive" });
    }
  };

  if (!isLoggedIn) return null;

  if (placedOrder) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Order placed!</h1>
          <p className="text-xl text-gray-600 mb-8">
            Your order ID is <span className="font-bold text-red-600">#{placedOrder.invoiceNo}</span>.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 mb-10 text-left">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center">
              <Truck className="h-5 w-5 mr-2" /> What's next?
            </h3>
            <p className="text-amber-800 leading-relaxed">
              We'll call you within 24 hours to confirm and arrange dispatch via licensed cracker logistics. Track progress in your account.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={`/account/orders/${placedOrder.id}`}>
              <Button className="bg-red-600 hover:bg-red-700 h-14 px-10 rounded-full text-lg font-bold">View order</Button>
            </Link>
            <Link href="/catalogue">
              <Button variant="outline" className="h-14 px-10 rounded-full text-lg font-bold">Continue shopping</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-extrabold mb-4">Your cart is empty</h1>
          <Link href="/catalogue"><Button className="bg-red-600 hover:bg-red-700">Browse catalogue</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/cart" className="inline-flex items-center text-sm text-gray-500 hover:text-red-600 mb-8 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to cart
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-10">Checkout</h1>

          <form onSubmit={handlePlace} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 flex items-center"><MapPin className="h-5 w-5 mr-2 text-red-600" /> Delivery address</h2>

                {addresses.length > 0 && !showNewAddr && (
                  <div className="space-y-3 mb-4">
                    {addresses.map((a) => (
                      <label key={a.id} className={`block p-4 rounded-2xl border cursor-pointer transition ${selectedAddr === a.id ? "border-red-500 bg-red-50/50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="flex items-start gap-3">
                          <input type="radio" name="addr" checked={selectedAddr === a.id} onChange={() => setSelectedAddr(a.id)} className="mt-1" data-testid={`addr-radio-${a.id}`} />
                          <div className="flex-1">
                            <p className="font-semibold">{a.name} · {a.phone} {a.label && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100">{a.label}</span>}</p>
                            <p className="text-sm text-gray-600 mt-0.5">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} - {a.pincode}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                    <Button type="button" variant="outline" onClick={() => { setShowNewAddr(true); setNewAddr({ ...EMPTY_ADDR, name: customer?.name ?? "", phone: customer?.phone ?? "" }); }}>
                      <Plus className="h-4 w-4 mr-1" /> Add new address
                    </Button>
                  </div>
                )}

                {showNewAddr && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Recipient name *</Label><Input value={newAddr.name} onChange={(e) => setNewAddr({ ...newAddr, name: e.target.value })} required data-testid="checkout-name" /></div>
                    <div><Label>Phone *</Label><Input value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} required data-testid="checkout-phone" /></div>
                    <div className="md:col-span-2"><Label>Address line 1 *</Label><Input value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} required data-testid="checkout-line1" /></div>
                    <div className="md:col-span-2"><Label>Address line 2</Label><Input value={newAddr.line2} onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })} /></div>
                    <div><Label>City *</Label><Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} required data-testid="checkout-city" /></div>
                    <div><Label>State *</Label><Input value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} required /></div>
                    <div><Label>Pincode *</Label><Input value={newAddr.pincode} onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })} required data-testid="checkout-pincode" /></div>
                    <div><Label>Landmark</Label><Input value={newAddr.landmark} onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })} /></div>
                    {addresses.length > 0 && (
                      <div className="md:col-span-2">
                        <Button type="button" variant="ghost" onClick={() => setShowNewAddr(false)}>Use a saved address instead</Button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Payment method</h2>
                <div className="space-y-2">
                  {[
                    { v: "COD", label: "Cash on Delivery", desc: "Pay our delivery rep at the doorstep." },
                    { v: "UPI", label: "UPI / QR", desc: "We'll share UPI / QR during the verification call." },
                    { v: "BANK", label: "Bank transfer", desc: "We'll share bank details during the verification call." },
                  ].map((opt) => (
                    <label key={opt.v} className={`block p-4 rounded-2xl border cursor-pointer transition ${paymentMode === opt.v ? "border-red-500 bg-red-50/50" : "border-gray-200"}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" name="pay" checked={paymentMode === opt.v} onChange={() => setPaymentMode(opt.v as any)} className="mt-1" data-testid={`payment-${opt.v}`} />
                        <div>
                          <p className="font-semibold">{opt.label}</p>
                          <p className="text-sm text-gray-600">{opt.desc}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <Label className="mb-2 block">Order notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special delivery instructions…" />
              </section>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 sticky top-28">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Order summary</h2>
                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
                  {items.map(item => (
                    <div key={`${item.productId}-${item.variantId}`} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.qty} × {item.productName}</span>
                      <span className="font-medium">₹{item.unitPrice * item.qty}</span>
                    </div>
                  ))}
                </div>
                <Separator className="mb-6" />
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-gray-600"><span>GST (18%)</span><span className="font-medium">₹{gst.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xl font-extrabold text-gray-900 pt-3 border-t"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xl shadow-lg shadow-red-900/10"
                  disabled={placeOrder.isPending || createAddr.isPending}
                  data-testid="checkout-place-order"
                >
                  {placeOrder.isPending ? "Placing order…" : "Place order"}
                </Button>
                <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-gray-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Secure checkout · Verified seller</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
