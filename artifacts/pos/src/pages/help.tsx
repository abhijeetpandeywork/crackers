import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, KeyRound, ShoppingCart, Pause, Tag, Award, Printer, X } from "lucide-react";

const STEPS = [
  {
    icon: KeyRound,
    title: "1. Sign in with PIN",
    body: "Pick your name from the cashier dropdown, then tap your 4-digit PIN on the keypad. Default cashier PIN is 3456.",
  },
  {
    icon: ShoppingCart,
    title: "2. Build the sale",
    body: "Search a product on the left panel. Tap a variant to add it to the cart. Use + / − on each cart line to adjust qty. Tap the trash icon to remove.",
  },
  {
    icon: Tag,
    title: "3. Apply coupon (optional)",
    body: "Enter a coupon code in the cart, tap Apply. The discount appears in the totals box. Coupons are validated against the live ERP — invalid or expired codes are rejected.",
  },
  {
    icon: Award,
    title: "4. Loyalty redeem (optional)",
    body: "Search and select the customer (top of cart). If they have loyalty points, toggle Redeem to apply. Walk-in sales skip this step.",
  },
  {
    icon: Pause,
    title: "5. Hold a bill",
    body: "Customer wandered off? Tap Hold to park the cart. Open the Held Bills sheet later to resume any saved cart on any terminal.",
  },
  {
    icon: ShoppingCart,
    title: "6. Checkout",
    body: "Choose CASH, CARD, or UPI. For CASH, enter the received amount — change is calculated automatically. Tap CHECKOUT.",
  },
  {
    icon: Printer,
    title: "7. Receipt & print",
    body: "The receipt screen shows invoice number and totals. Tap Print to print, or New Sale to start the next customer.",
  },
];

const RULES = [
  "qty ≥ 10 of the same item auto-switches to wholesale rate.",
  "Cashiers cannot change prices — talk to your manager for overrides.",
  "Stock is checked at checkout — out-of-stock items will block the sale.",
  "Every sale is idempotent — accidental double-tap won't double-charge.",
];

export default function PosHelp() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/sale">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Sale
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/sale")}
            className="text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">POS — How to use</h1>
          <p className="text-white/60 mt-1">Step-by-step cashier guide</p>
        </div>

        <div className="space-y-3">
          {STEPS.map((s) => (
            <Card key={s.title} className="bg-[#1a1a1a] border-white/10 text-white">
              <CardContent className="pt-5">
                <div className="flex gap-3">
                  <div className="rounded-md bg-orange-500/15 p-2 h-fit">
                    <s.icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{s.title}</h3>
                    <p className="text-sm text-white/70 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-orange-500/10 border-orange-500/30 text-white">
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-2 text-orange-300">Important rules</h3>
            <ul className="space-y-1.5 text-sm text-white/80">
              {RULES.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-white/10 text-white">
          <CardContent className="pt-5 text-sm">
            <h3 className="font-semibold mb-2">Default PINs (demo)</h3>
            <div className="grid grid-cols-2 gap-2 text-white/80">
              <div>Admin — <code className="bg-white/10 px-1.5 py-0.5 rounded">1234</code></div>
              <div>Manager — <code className="bg-white/10 px-1.5 py-0.5 rounded">2345</code></div>
              <div>Cashier — <code className="bg-white/10 px-1.5 py-0.5 rounded">3456</code></div>
              <div>Warehouse — <code className="bg-white/10 px-1.5 py-0.5 rounded">4567</code></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
