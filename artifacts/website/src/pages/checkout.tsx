import { useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/context/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  Truck, 
  CreditCard, 
  ShieldCheck,
  ChevronLeft
} from "lucide-react";
import { Layout } from "@/components/layout";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [isPlaced, setIsPlaced] = useState(false);
  const [needGst, setNeedGst] = useState(false);
  const [orderId] = useState(() => Math.random().toString(36).substr(2, 9).toUpperCase());

  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPlaced(true);
    clearCart();
  };

  if (isPlaced) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Order Placed!</h1>
          <p className="text-xl text-gray-600 mb-8">
            Thank you for choosing Rathinam Crackers. Your Order ID is <span className="font-bold text-red-600">#{orderId}</span>.
          </p>
          
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8 mb-10 text-left">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center">
              <Truck className="h-5 w-5 mr-2" /> What's next?
            </h3>
            <p className="text-amber-800 leading-relaxed">
              We'll call you within 24 hours to confirm your order details and arrange for payment (Cash on Delivery / Bank Transfer) and delivery logistics.
            </p>
          </div>

          <Link href="/catalogue">
            <Button className="bg-red-600 hover:bg-red-700 h-14 px-10 rounded-full text-lg font-bold">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/cart" className="inline-flex items-center text-sm text-gray-500 hover:text-red-600 mb-8 transition-colors">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Cart
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-10">Checkout</h1>

          <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Checkout Form */}
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 flex items-center">
                  <Truck className="h-5 w-5 mr-2 text-red-600" /> Delivery Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" required placeholder="John Doe" className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" required type="tel" placeholder="+91 00000 00000" className="rounded-xl h-12" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" required type="email" placeholder="john@example.com" className="rounded-xl h-12" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="address">Full Delivery Address</Label>
                    <Textarea id="address" required placeholder="House No, Street, Landmark..." className="rounded-xl min-h-[100px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" required placeholder="Sivakasi" className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input id="pincode" required placeholder="626123" className="rounded-xl h-12" />
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-2 mb-6">
                  <Checkbox 
                    id="gst-invoice" 
                    checked={needGst} 
                    onCheckedChange={(checked) => setNeedGst(checked as boolean)}
                  />
                  <Label htmlFor="gst-invoice" className="font-bold text-gray-900">I need a GST Invoice</Label>
                </div>

                {needGst && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <Input id="gstin" required placeholder="33AAAAA0000A1Z5" className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name</Label>
                      <Input id="company" required placeholder="Your Company Ltd" className="rounded-xl h-12" />
                    </div>
                  </div>
                )}
              </section>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                <div className="flex items-start space-x-3">
                  <CreditCard className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-bold text-blue-900 mb-1">Payment Information</h4>
                    <p className="text-sm text-blue-800">
                      We currently support <strong>Cash on Delivery</strong> and <strong>Direct Bank Transfer</strong>. Our representative will share bank details or confirm COD eligibility during the verification call.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 sticky top-28">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
                
                <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto no-scrollbar">
                  {items.map(item => (
                    <div key={`${item.productId}-${item.variantId}`} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.qty} x {item.productName}
                      </span>
                      <span className="font-medium">₹{item.unitPrice * item.qty}</span>
                    </div>
                  ))}
                </div>

                <Separator className="mb-6" />

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST (18%)</span>
                    <span className="font-medium">₹{gst.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xl font-extrabold text-gray-900 pt-3 border-t">
                    <span>Grand Total</span>
                    <span>₹{total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <Button type="submit" className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xl shadow-lg shadow-red-900/10">
                  Place Order
                </Button>

                <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-gray-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Secure Checkout & Verified Seller</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
