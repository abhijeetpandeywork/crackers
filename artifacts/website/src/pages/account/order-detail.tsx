import { Link, useRoute } from "wouter";
import { AccountShell } from "@/components/account-shell";
import { useGetShopOrder } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Receipt, Truck } from "lucide-react";

type Addr = {
  name?: string; phone?: string; line1?: string; line2?: string | null;
  city?: string; state?: string; pincode?: string; landmark?: string | null;
};

function AddressBlock({ title, icon, addr }: { title: string; icon: React.ReactNode; addr: Addr }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <h2 className="font-bold mb-3 flex items-center gap-2">{icon} {title}</h2>
      <p className="font-semibold">{addr.name} · {addr.phone}</p>
      <p className="text-sm text-gray-600 mt-1">
        {addr.line1}
        {addr.line2 ? `, ${addr.line2}` : ""}
        {addr.city ? `, ${addr.city}` : ""}{addr.state ? `, ${addr.state}` : ""}
        {addr.pincode ? ` - ${addr.pincode}` : ""}
      </p>
      {addr.landmark && <p className="text-xs text-gray-500 mt-1">Landmark: {addr.landmark}</p>}
    </div>
  );
}

export default function OrderDetail() {
  const [, params] = useRoute("/account/orders/:id");
  const id = params?.id ?? "";
  const { data, isLoading } = useGetShopOrder(id);
  const order = (data as any)?.data;

  return (
    <AccountShell>
      <Link href="/account/orders" className="text-sm text-primary font-semibold inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to orders
      </Link>
      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : !order ? (
        <p className="text-gray-500">Order not found.</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold">Order #{order.invoiceNo}</h1>
              <p className="text-sm text-gray-500">Placed on {new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <Badge variant="secondary" className="capitalize text-sm">
              {(order.logisticsDetails?.status ?? order.status)?.toString().replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
            <h2 className="font-bold mb-3">Items</h2>
            <div className="space-y-2">
              {(order.items ?? []).map((it: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-semibold">{it.productName}</p>
                    <p className="text-xs text-gray-500">{it.variantSize} × {it.qty}</p>
                  </div>
                  <p className="font-bold">₹{Number(it.amount).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(order.subtotal).toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span>GST</span><span>₹{(Number(order.cgst) + Number(order.sgst)).toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between font-extrabold text-lg pt-2 border-t"><span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span></div>
            </div>
          </div>

          {(() => {
            const ld = order.logisticsDetails ?? {};
            // Prefer canonical shippingAddress; fall back to legacy `address` key.
            const ship: Addr | null = ld.shippingAddress ?? ld.address ?? null;
            const bill: Addr | null = ld.billingAddress ?? null;
            const sameAsShipping = ld.sameAsShipping ?? (!bill || JSON.stringify(bill) === JSON.stringify(ship));
            if (!ship && !bill) return null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {ship && <AddressBlock title="Shipping to" icon={<MapPin className="h-4 w-4" />} addr={ship} />}
                {bill && !sameAsShipping ? (
                  <AddressBlock title="Billing to" icon={<Receipt className="h-4 w-4" />} addr={bill} />
                ) : ship ? (
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-center text-sm text-gray-500">
                    Billing address same as shipping
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <Truck className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-bold">What happens next?</p>
                <p>Our team will call you within 24 hours to confirm and arrange dispatch via licensed cracker logistics. You'll receive SMS / WhatsApp updates with tracking.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </AccountShell>
  );
}
