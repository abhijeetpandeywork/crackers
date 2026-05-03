import { Link, useRoute } from "wouter";
import { AccountShell } from "@/components/account-shell";
import { useGetShopOrder } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Truck } from "lucide-react";

export default function OrderDetail() {
  const [, params] = useRoute("/account/orders/:id");
  const id = params?.id ?? "";
  const { data, isLoading } = useGetShopOrder(id);
  const order = (data as any)?.data;

  return (
    <AccountShell>
      <Link href="/account/orders" className="text-sm text-red-600 font-semibold inline-flex items-center gap-1 mb-4">
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

          {order.logisticsDetails?.address && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
              <h2 className="font-bold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery to</h2>
              <p className="font-semibold">{order.logisticsDetails.address.name} · {order.logisticsDetails.address.phone}</p>
              <p className="text-sm text-gray-600 mt-1">
                {order.logisticsDetails.address.line1}
                {order.logisticsDetails.address.line2 ? `, ${order.logisticsDetails.address.line2}` : ""},{" "}
                {order.logisticsDetails.address.city}, {order.logisticsDetails.address.state} - {order.logisticsDetails.address.pincode}
              </p>
            </div>
          )}

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
