import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetPosProducts,
  useHoldBill,
  useListHeldBills,
  useValidateCoupon,
  usePosCreateSale,
  useCloseShift,
  useOpenShift,
  useGetCurrentShift,
  useGetRecentPosSales,
  useListCustomers,
} from "@workspace/api-client-react";
import { useCart, type CouponData, type CartItem } from "@/context/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, Plus, Minus, Trash2, Pause, History, LogOut, User, UserX,
  HelpCircle, ScanLine, Keyboard, Settings2, Wallet, Receipt, Tag,
} from "lucide-react";
import ScannerSettingsDialog from "@/components/pos/scanner-settings-dialog";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const categories = ["All", "Ground", "Aerial", "Sparkler", "Gift Box", "Bundle"];
const DEFAULT_QUICK_CASH = [100, 200, 500, 1000, 2000];

type PosConfig = {
  quickCash: number[];
  paymentMethods: { cash: boolean; upi: boolean; card: boolean; credit: boolean };
};
const DEFAULT_POS_CONFIG: PosConfig = {
  quickCash: DEFAULT_QUICK_CASH,
  paymentMethods: { cash: true, upi: true, card: true, credit: true },
};

type Variant = { variantId?: string; id?: string; size?: string; label?: string; price?: number | string; stock?: number };
type Product = { id: string; code?: string; name: string; category?: string; variants?: Variant[] };

const inr = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SaleScreen = () => {
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [couponCode, setCouponCode] = useState("");
  const [activeLocationId, setActiveLocationId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [heldBillsOpen, setHeldBillsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [scannerSettingsOpen, setScannerSettingsOpen] = useState(false);

  // Shift state
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [zReport, setZReport] = useState<any | null>(null);

  // Multi-tender state — independent amounts per mode.
  const [tenderCash, setTenderCash] = useState("");
  const [tenderUpi, setTenderUpi] = useState("");
  const [tenderCard, setTenderCard] = useState("");
  const [tenderUpiRef, setTenderUpiRef] = useState("");
  const [tenderCardRef, setTenderCardRef] = useState("");

  // Manual discount
  const [manualDiscount, setManualDiscount] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Reprint
  const [reprintOpen, setReprintOpen] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const {
    items, addItem, removeItem, updateQty, clearCart, loadHeldBill,
    subtotal, gst, discount, total: cartTotal,
    coupon, applyCoupon, customer, setCustomer,
  } = useCart();

  // Sale total includes the manual discount on top of coupon discount.
  const md = Math.max(0, parseFloat(manualDiscount) || 0);
  const taxableAmount = Math.max(0, subtotal - discount - md);
  const gstAdj = taxableAmount * 0.18;
  const total = taxableAmount + gstAdj;

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Resolve real location ID once on mount.
  useEffect(() => {
    const token = localStorage.getItem("pos_token");
    if (!token) return;
    fetch("/api/v1/locations", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((res) => {
        const locs = res?.data ?? [];
        const shop = locs.find((l: any) => l.type === "shop") ?? locs[0];
        if (shop?.id) setActiveLocationId(shop.id);
      })
      .catch(() => {});
  }, []);

  // POS config (quick cash denominations + enabled payment methods) is admin-
  // editable in the ERP CMS. Falls back to the original defaults if the call fails.
  const [posConfig, setPosConfig] = useState<PosConfig>(DEFAULT_POS_CONFIG);
  useEffect(() => {
    fetch("/api/v1/site-content/public")
      .then((r) => r.json())
      .then((res) => {
        const pos = res?.data?.pos ?? {};
        const qc = Array.isArray(pos.quickCash)
          ? pos.quickCash.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
          : DEFAULT_QUICK_CASH;
        setPosConfig({
          quickCash: qc.length ? qc : DEFAULT_QUICK_CASH,
          paymentMethods: {
            cash:   pos.paymentMethods?.cash   !== false,
            upi:    pos.paymentMethods?.upi    !== false,
            card:   pos.paymentMethods?.card   !== false,
            credit: pos.paymentMethods?.credit !== false,
          },
        });
      })
      .catch(() => {});
  }, []);
  const QUICK_CASH = posConfig.quickCash;
  const pmEnabled = posConfig.paymentMethods;

  const { data: productsData } = useGetPosProducts(
    { locationId: activeLocationId },
    { query: { enabled: !!activeLocationId, queryKey: ["pos-products", activeLocationId] } },
  );
  const { mutate: holdBill } = useHoldBill();
  const { data: heldBillsResponse, refetch: refetchHeldBills } = useListHeldBills(
    { locationId: activeLocationId },
    { query: { enabled: !!activeLocationId, queryKey: ["held-bills", activeLocationId] } },
  );
  const { mutate: validateCoupon, isPending: validatingCoupon } = useValidateCoupon();
  const { mutate: createSale, isPending: checkingOut } = usePosCreateSale();
  const { mutate: closeShift, isPending: closingShift } = useCloseShift();
  const { mutate: openShift, isPending: openingShift } = useOpenShift();

  const {
    data: currentShiftResp,
    refetch: refetchShift,
    isLoading: shiftLoading,
  } = useGetCurrentShift(
    { locationId: activeLocationId || undefined },
    { query: { enabled: !!activeLocationId, queryKey: ["pos-shift-current", activeLocationId], refetchInterval: 30000 } },
  );
  const currentShift = (currentShiftResp?.data ?? null) as any;

  const { data: recentResp, refetch: refetchRecent } = useGetRecentPosSales(
    { locationId: activeLocationId || undefined, limit: 10 },
    { query: { enabled: !!activeLocationId && reprintOpen, queryKey: ["pos-recent", activeLocationId] } },
  );
  const recentSales = (recentResp?.data ?? []) as any[];

  const { data: customersData } = useListCustomers(
    { search: customerSearch || undefined, limit: 10 },
    { query: { enabled: customerSearch.length >= 2, queryKey: ["customers", customerSearch] } },
  );

  const products: Product[] = (productsData?.data ?? []) as Product[];
  const heldBills = heldBillsResponse?.data || [];

  // Auto-open the shift-open dialog the first time we land here without a shift.
  useEffect(() => {
    if (shiftLoading || !activeLocationId) return;
    if (!currentShift && !openShiftDialog) {
      setOpenShiftDialog(true);
    }
  }, [shiftLoading, currentShift, activeLocationId, openShiftDialog]);

  // -------- Filters --------
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = activeCategory === "All" || (p.category && p.category.toLowerCase() === activeCategory.toLowerCase());
      if (!catOk) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || (p.code ?? "").toLowerCase().includes(term);
    });
  }, [products, search, activeCategory]);

  // -------- Helpers --------
  const variantPrice = (v: Variant) => Number(v.price) || 0;
  const variantId = (v: Variant) => v.variantId ?? v.id ?? "";
  const variantLabel = (v: Variant) => v.size ?? v.label ?? "Standard";

  const addVariantToCart = useCallback((product: Product, variant: Variant) => {
    const stock = typeof variant.stock === "number" ? variant.stock : Infinity;
    if (stock <= 0) {
      toast({ title: "Out of stock", description: `${product.name} (${variantLabel(variant)})`, variant: "destructive" });
      return;
    }
    addItem({
      productId: product.id, variantId: variantId(variant),
      productName: product.name, variantLabel: variantLabel(variant),
      qty: 1, unitPrice: variantPrice(variant),
    });
  }, [addItem, toast]);

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    validateCoupon(
      { data: { code: couponCode, cartTotal: subtotal } },
      {
        onSuccess: (res) => {
          if (res.data?.valid) {
            applyCoupon({ code: couponCode, type: "PERCENT", value: res.data.discountAmount || 0 });
            toast({ title: "Coupon applied" });
          } else {
            toast({ title: res.data?.error || "Invalid coupon", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Error validating coupon", variant: "destructive" }),
      },
    );
  };

  // ---- multi-tender helpers ----
  const cashAmt = parseFloat(tenderCash) || 0;
  const upiAmt = parseFloat(tenderUpi) || 0;
  const cardAmt = parseFloat(tenderCard) || 0;
  const tenderTotal = cashAmt + upiAmt + cardAmt;
  const remainingDue = Math.max(0, total - tenderTotal);
  const overTendered = tenderTotal > total + 0.5;
  const change = cashAmt > 0 ? Math.max(0, tenderTotal - total) : 0;

  const setCashExact = () => setTenderCash((Math.max(0, total - upiAmt - cardAmt)).toFixed(2));
  const addCash = (amt: number) => {
    const current = parseFloat(tenderCash) || 0;
    setTenderCash((current + amt).toString());
  };

  const handleCheckout = () => {
    if (items.length === 0) { toast({ title: "Cart is empty", variant: "destructive" }); return; }
    if (!currentShift?.id) { toast({ title: "Open a shift first", variant: "destructive" }); setOpenShiftDialog(true); return; }
    if (overTendered && !cashAmt) {
      toast({ title: "Tender exceeds bill (only cash can over-tender for change)", variant: "destructive" });
      return;
    }
    if (remainingDue > 0.5) {
      toast({ title: `Short by ${inr(remainingDue)}`, variant: "destructive" });
      return;
    }

    const tenders: Array<{ mode: "CASH" | "UPI" | "CARD"; amount: number; reference?: string }> = [];
    // Cap cash at the actual portion of the bill so over-tender becomes change, not paid amount.
    if (cashAmt > 0) tenders.push({ mode: "CASH", amount: Math.min(cashAmt, total - upiAmt - cardAmt) });
    if (upiAmt > 0) tenders.push({ mode: "UPI", amount: upiAmt, reference: tenderUpiRef || undefined });
    if (cardAmt > 0) tenders.push({ mode: "CARD", amount: cardAmt, reference: tenderCardRef || undefined });

    createSale(
      {
        data: {
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          tenders,
          cashReceived: cashAmt,
          orderDiscount: md > 0 ? md : undefined,
          discountReason: md > 0 ? (discountReason || undefined) : undefined,
          locationId: activeLocationId,
          shiftId: currentShift.id,
          couponCode: coupon?.code,
          customerId: customer?.id,
        },
      },
      {
        onSuccess: (res) => {
          if (res.data?.invoice?.id) {
            refetchShift();
            refetchRecent();
            const ch = change.toFixed(2);
            setLocation(`/receipt?id=${res.data.invoice.id}&change=${ch}&received=${cashAmt || ""}`);
            // Clear tender inputs for next sale
            setTenderCash(""); setTenderUpi(""); setTenderCard("");
            setTenderUpiRef(""); setTenderCardRef("");
            setManualDiscount(""); setDiscountReason("");
          }
        },
        onError: (err) => toast({ title: "Checkout failed", description: (err as any).message, variant: "destructive" }),
      },
    );
  };

  const handleHoldBill = () => {
    if (items.length === 0) { toast({ title: "Nothing to hold" }); return; }
    holdBill(
      {
        data: {
          locationId: activeLocationId, customerId: customer?.id,
          items: items.map((i: CartItem) => ({
            productId: i.productId, variantId: i.variantId,
            productName: i.productName, variantLabel: i.variantLabel,
            qty: i.qty, unitPrice: i.unitPrice,
          })),
          coupon: coupon ? ({ ...coupon } as Record<string, unknown>) : undefined,
        },
      },
      { onSuccess: () => { clearCart(); refetchHeldBills(); toast({ title: "Bill held" }); } },
    );
  };

  type ResumableHeldBill = {
    items?: Array<{ productId?: string; variantId?: string; productName?: string; variantLabel?: string; qty?: number; unitPrice?: number }>;
    customer?: unknown;
    coupon?: CouponData | null;
  };
  const handleResumeBill = (bill: ResumableHeldBill) => {
    const billItems = (bill.items ?? []).map((i) => ({
      productId: i.productId ?? "", variantId: i.variantId ?? "",
      productName: i.productName ?? "Item", variantLabel: i.variantLabel ?? "",
      qty: i.qty ?? 1, unitPrice: i.unitPrice ?? 0,
    }));
    loadHeldBill({ items: billItems, customer: bill.customer ?? null, coupon: bill.coupon ?? null });
    setHeldBillsOpen(false);
    toast({ title: "Bill resumed", description: `Loaded ${billItems.length} items` });
  };

  const handleOpenShift = () => {
    const oc = parseFloat(openingCash);
    if (!activeLocationId || isNaN(oc) || oc < 0) { toast({ title: "Enter opening cash", variant: "destructive" }); return; }
    openShift(
      { data: { locationId: activeLocationId, openingCash: oc } },
      {
        onSuccess: () => { setOpenShiftDialog(false); setOpeningCash(""); refetchShift(); toast({ title: "Shift opened", description: `Float ${inr(oc)}` }); },
        onError: (err) => toast({ title: "Could not open shift", description: (err as any).message, variant: "destructive" }),
      },
    );
  };

  const handleCloseShift = () => {
    if (!currentShift?.id) { toast({ title: "No open shift" }); return; }
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) { toast({ title: "Enter counted cash", variant: "destructive" }); return; }
    closeShift(
      { data: { shiftId: currentShift.id, closingCash: counted, notes: closingNotes || undefined } },
      {
        onSuccess: (res) => { setZReport(res.data); refetchShift(); toast({ title: "Shift closed" }); },
        onError: (err) => toast({ title: "Close failed", description: (err as any).message, variant: "destructive" }),
      },
    );
  };

  const handleZReportDone = () => {
    setZReport(null);
    setCloseShiftOpen(false);
    setCountedCash(""); setClosingNotes("");
    localStorage.removeItem("pos_token");
    setLocation("/");
  };

  // -------- Barcode --------
  const handleBarcodeSubmit = () => {
    const code = barcode.trim();
    if (!code) return;
    const match = products.find((p) => (p.code ?? "").toLowerCase() === code.toLowerCase());
    if (!match) { toast({ title: "No product matches that code", variant: "destructive" }); return; }
    const variants = match.variants ?? [];
    const inStock = variants.find((v) => (typeof v.stock === "number" ? v.stock > 0 : true)) ?? variants[0];
    if (!inStock) { toast({ title: `${match.name} has no variants`, variant: "destructive" }); return; }
    addVariantToCart(match, inStock);
    setBarcode("");
  };

  // -------- Keyboard shortcuts --------
  const focusBarcode = useCallback(() => barcodeRef.current?.focus(), []);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);

  useKeyboardShortcuts({
    F2: focusSearch,
    F3: focusBarcode,
    F4: () => setCustomerOpen(true),
    F9: handleHoldBill,
    F12: handleCheckout,
    "?": () => setShortcutsOpen((v) => !v),
    Escape: () => {
      if (shortcutsOpen) { setShortcutsOpen(false); return; }
      if (customerOpen) { setCustomerOpen(false); return; }
      setSearch(""); setBarcode(""); barcodeRef.current?.focus();
    },
  });

  useEffect(() => { barcodeRef.current?.focus(); }, [items.length]);

  useBarcodeScanner({
    enabled: !scannerSettingsOpen && !openShiftDialog && !closeShiftOpen,
    onScan: ({ code }) => {
      const match = products.find((p) => (p.code ?? "").toLowerCase() === code.toLowerCase());
      if (!match) { toast({ title: "No product matches that scan", description: code, variant: "destructive" }); return; }
      const variants = match.variants ?? [];
      const inStock = variants.find((v) => (typeof v.stock === "number" ? v.stock > 0 : true)) ?? variants[0];
      if (!inStock) { toast({ title: `${match.name} has no variants`, variant: "destructive" }); return; }
      addVariantToCart(match, inStock);
      setBarcode("");
    },
  });

  const running = currentShift?.running ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d]">
      {/* Left Panel: Products */}
      <div className="w-[60%] flex flex-col border-r border-zinc-800">
        {/* Shift bar */}
        {currentShift && running && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-lg px-3 py-2 text-xs">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <span className="text-zinc-400">Shift</span>
              <span className="font-bold text-white">{String(currentShift.id).slice(0, 8)}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Float</span>
              <span className="font-bold">{inr(Number(currentShift.openingCash) || 0)}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Sales</span>
              <span className="font-bold text-amber-300">{inr(running.totalSales || 0)}</span>
              <span className="text-zinc-500">({running.txnCount || 0} txn)</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Drawer</span>
              <span className="font-bold text-emerald-400">{inr(running.expectedCash || 0)}</span>
              <Button
                size="sm" variant="ghost"
                className="ml-auto h-7 text-xs text-blue-400 hover:text-blue-300"
                onClick={() => setReprintOpen(true)}
                data-testid="pos-reprint-btn"
              >
                <Receipt className="h-3.5 w-3.5 mr-1" /> Reprint
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
              <Input
                ref={barcodeRef}
                placeholder="Scan barcode or type product code, then press Enter  (F3)"
                className="pl-10 h-14 bg-zinc-900 border-primary/40 text-lg focus-visible:ring-primary"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeSubmit(); } }}
                data-testid="pos-barcode-input"
              />
            </div>
            <Button variant="outline" size="icon" className="h-14 w-14 border-zinc-800" onClick={() => setScannerSettingsOpen(true)} title="Scanner settings">
              <Settings2 className="h-6 w-6 text-primary" />
            </Button>
            <Button variant="outline" size="icon" className="h-14 w-14 border-zinc-800" onClick={() => setShortcutsOpen(true)} title="Shortcuts (?)">
              <Keyboard className="h-6 w-6 text-blue-400" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-14 w-14 border-zinc-800"
              onClick={() => { if (!currentShift) { setOpenShiftDialog(true); } else { setCloseShiftOpen(true); } }}
              title={currentShift ? "End shift (Z-report)" : "Open shift"}
              data-testid="pos-shift-toggle"
            >
              <LogOut className={`h-6 w-6 ${currentShift ? "text-red-500" : "text-emerald-500"}`} />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              ref={searchRef}
              placeholder="Search products by name or code  (F2)"
              className="pl-10 h-11 bg-zinc-900 border-zinc-800"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="pos-product-search"
            />
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-zinc-900 w-full justify-start overflow-x-auto p-1 h-auto">
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="bg-zinc-900 border-zinc-800 overflow-hidden hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center p-4">
                    <span className="text-zinc-600 font-bold text-4xl">{product.code}</span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold truncate text-lg" title={product.name}>{product.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(product.variants ?? []).map((variant) => {
                        const stock = typeof variant.stock === "number" ? variant.stock : null;
                        const oos = stock !== null && stock <= 0;
                        const low = stock !== null && stock > 0 && stock <= 5;
                        return (
                          <Button
                            key={variantId(variant)} variant="secondary" size="sm" disabled={oos}
                            className={`text-xs h-10 bg-zinc-800 hover:bg-primary hover:text-white relative ${oos ? "opacity-40 cursor-not-allowed" : ""}`}
                            onClick={() => addVariantToCart(product, variant)}
                            title={oos ? "Out of stock" : low ? `Only ${stock} left` : `${stock ?? "?"} in stock`}
                          >
                            <span className="font-bold">{variantLabel(variant)}</span>
                            <span className="ml-2">₹{variantPrice(variant)}</span>
                            {low && <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-amber-500 text-[10px] text-black font-black px-1 leading-4">{stock}</span>}
                            {oos && <span className="absolute -top-1.5 -right-1.5 h-4 px-1 rounded-full bg-red-600 text-[10px] text-white font-black leading-4">OUT</span>}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-600">
                <Search className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">No products match your filter</p>
                <p className="text-sm">Press Esc to clear, or F3 to scan a barcode</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1 bg-zinc-950/40">
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">F2</kbd> Search</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">F3</kbd> Scan</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">F4</kbd> Customer</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">F9</kbd> Hold</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">F12</kbd> Checkout</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">?</kbd> Help</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">Esc</kbd> Reset</span>
        </div>
      </div>

      {/* Right Panel: Cart */}
      <div className="w-[40%] flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black">CART</h2>
            <Badge variant="outline" className="text-primary border-primary">{items.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Sheet open={heldBillsOpen} onOpenChange={setHeldBillsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="border-zinc-800" data-testid="held-bills-trigger" title="Held bills">
                  <History className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-zinc-950 border-zinc-800 text-white w-[400px]">
                <SheetHeader><SheetTitle className="text-white text-2xl font-black">HELD BILLS</SheetTitle></SheetHeader>
                <div className="mt-8 space-y-4">
                  {heldBills.map((bill: any) => (
                    <div key={bill.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold">Bill #{String(bill.id).slice(0, 8)}</p>
                        <p className="text-xs text-zinc-500">
                          {(bill.items?.length ?? 0)} items
                          {bill.createdAt ? ` • ${new Date(bill.createdAt).toLocaleTimeString()}` : ""}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleResumeBill(bill)} data-testid={`resume-${bill.id}`}>Resume</Button>
                    </div>
                  ))}
                  {!heldBills.length && <p className="text-center text-zinc-600 py-8">No held bills</p>}
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="icon" className="border-zinc-800 text-amber-500" onClick={handleHoldBill} title="Hold (F9)">
              <Pause className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="border-zinc-800 text-red-500" onClick={clearCart} title="Clear cart">
              <Trash2 className="h-5 w-5" />
            </Button>
            <Link href="/help">
              <Button variant="outline" size="icon" className="border-zinc-800 text-blue-400" data-testid="pos-help-link" title="Help">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {items.map((item) => (
              <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-900">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base leading-tight truncate" title={item.productName}>{item.productName}</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.variantLabel} • ₹{item.unitPrice.toLocaleString("en-IN")}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <div className="text-right min-w-[80px]"><p className="font-black text-lg">₹{item.lineTotal.toLocaleString("en-IN")}</p></div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-red-500" onClick={() => removeItem(item.productId, item.variantId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                <ScanLine className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-xl font-bold">Cart is empty</p>
                <p className="text-sm text-zinc-600 mt-2">Scan a barcode or tap a product</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-3">
          {/* Coupon + manual discount */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex gap-2">
              <Input placeholder="Coupon" className="h-10 bg-zinc-950 border-zinc-800" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
              <Button variant="secondary" className="h-10 px-3" onClick={handleApplyCoupon} disabled={validatingCoupon || !couponCode}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Manual disc ₹"
              type="number" inputMode="decimal"
              className="h-10 bg-zinc-950 border-zinc-800"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
              data-testid="pos-manual-discount"
            />
          </div>
          {md > 0 && (
            <Input
              placeholder="Discount reason (e.g. damaged box, manager comp)"
              className="h-9 bg-zinc-950 border-zinc-800 text-xs"
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
            />
          )}

          {/* Customer */}
          <div className="flex items-center gap-2">
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 h-11 bg-zinc-950 border-zinc-800 justify-start text-left" data-testid="customer-picker">
                  <User className="h-4 w-4 mr-2 text-primary" />
                  {customer ? (
                    <span className="truncate">
                      <span className="font-bold">{customer.name}</span>
                      {customer.phone ? <span className="text-zinc-500 ml-2">{customer.phone}</span> : null}
                    </span>
                  ) : <span className="text-zinc-500">Walk-in customer  (F4)</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] bg-zinc-950 border-zinc-800 p-0" align="start">
                <div className="p-3 border-b border-zinc-800">
                  <Input autoFocus placeholder="Search by name or phone…" className="bg-zinc-900 border-zinc-800 h-10"
                    value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} data-testid="customer-search-input" />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {customerSearch.length < 2 && <p className="text-xs text-zinc-500 p-3">Type at least 2 characters</p>}
                  {customerSearch.length >= 2 && (customersData?.data ?? []).length === 0 && <p className="text-xs text-zinc-500 p-3">No matches. Leave blank for walk-in.</p>}
                  {(customersData?.data ?? []).map((c) => (
                    <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(""); setCustomerOpen(false); }}
                      className="w-full text-left p-3 hover:bg-zinc-900 border-b border-zinc-900" data-testid={`customer-option-${c.id}`}>
                      <p className="font-bold text-sm">{c.name}</p>
                      <p className="text-xs text-zinc-500">{c.phone} {c.customerType ? `• ${c.customerType}` : ""}</p>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {customer && (
              <Button variant="outline" size="icon" className="h-11 w-11 border-zinc-800 text-red-400" onClick={() => setCustomer(null)} title="Clear">
                <UserX className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-zinc-400 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Coupon {coupon ? `(${coupon.code})` : ""}</span><span>- ₹{discount.toLocaleString("en-IN")}</span>
              </div>
            )}
            {md > 0 && (
              <div className="flex justify-between text-green-500"><span>Manual discount</span><span>- ₹{md.toLocaleString("en-IN")}</span></div>
            )}
            <div className="flex justify-between"><span>GST (18%)</span><span>₹{Math.round(gstAdj).toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-white text-3xl font-black pt-2 border-t border-zinc-800">
              <span>TOTAL</span><span className="text-primary">₹{Math.round(total).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Multi-tender (admin-toggleable per method via Website CMS → pos.paymentMethods) */}
          {(() => {
            const cols = (pmEnabled.cash ? 1 : 0) + (pmEnabled.upi ? 1 : 0) + (pmEnabled.card ? 1 : 0);
            const gridCls = cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1";
            return (
              <div className={`grid ${gridCls} gap-2 text-xs`}>
                {pmEnabled.cash && (
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black">Cash</label>
                    <Input ref={cashRef} type="number" inputMode="decimal" className="h-11 bg-zinc-950 border-zinc-800 font-bold"
                      value={tenderCash} onChange={(e) => setTenderCash(e.target.value)} data-testid="tender-cash" />
                  </div>
                )}
                {pmEnabled.upi && (
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black">UPI</label>
                    <Input type="number" inputMode="decimal" className="h-11 bg-zinc-950 border-zinc-800 font-bold"
                      value={tenderUpi} onChange={(e) => setTenderUpi(e.target.value)} data-testid="tender-upi" />
                  </div>
                )}
                {pmEnabled.card && (
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black">Card</label>
                    <Input type="number" inputMode="decimal" className="h-11 bg-zinc-950 border-zinc-800 font-bold"
                      value={tenderCard} onChange={(e) => setTenderCard(e.target.value)} data-testid="tender-card" />
                  </div>
                )}
                {pmEnabled.upi && upiAmt > 0 && (
                  <Input placeholder="UPI ref (optional)" className={`${cols === 3 ? "col-span-3" : cols === 2 ? "col-span-2" : "col-span-1"} h-9 bg-zinc-950 border-zinc-800 text-xs`} value={tenderUpiRef} onChange={(e) => setTenderUpiRef(e.target.value)} />
                )}
                {pmEnabled.card && cardAmt > 0 && (
                  <Input placeholder="Card last 4 (optional)" className={`${cols === 3 ? "col-span-3" : cols === 2 ? "col-span-2" : "col-span-1"} h-9 bg-zinc-950 border-zinc-800 text-xs`} value={tenderCardRef} onChange={(e) => setTenderCardRef(e.target.value)} />
                )}
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-2">
            {QUICK_CASH.map((amt) => (
              <Button key={amt} variant="outline" size="sm" className="h-9 px-3 border-zinc-800 bg-zinc-950 text-sm font-bold" onClick={() => addCash(amt)} data-testid={`quick-cash-${amt}`}>
                +₹{amt}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="h-9 px-3 border-primary/40 bg-zinc-950 text-sm font-bold text-primary" onClick={setCashExact} data-testid="quick-cash-exact">
              Exact ₹{Math.max(0, total - upiAmt - cardAmt).toFixed(2)}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-2 text-zinc-500" onClick={() => { setTenderCash(""); setTenderUpi(""); setTenderCard(""); }}>Clear</Button>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Tendered <span className="text-zinc-300 font-bold">{inr(tenderTotal)}</span></span>
            {remainingDue > 0
              ? <span className="text-red-500 font-bold">Due {inr(remainingDue)}</span>
              : change > 0
                ? <span className="text-green-500 font-bold">Change {inr(change)}</span>
                : <span className="text-emerald-500 font-bold">Settled</span>}
          </div>

          <Button
            className="w-full h-16 text-xl font-black rounded-xl shadow-lg shadow-primary/20"
            disabled={items.length === 0 || remainingDue > 0.5 || checkingOut || !currentShift}
            onClick={handleCheckout}
            data-testid="pos-checkout-btn"
          >
            {checkingOut ? "PROCESSING..." : `CHECKOUT  •  ${inr(total)}`}
          </Button>
        </div>
      </div>

      {/* Shortcuts overlay */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShortcutsOpen(false)}>
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-black">KEYBOARD SHORTCUTS</h2>
            <div className="space-y-2 text-sm">
              {[["F2","Search"],["F3","Scan"],["F4","Customer"],["F9","Hold"],["F12","Checkout"],["?","Help"],["Esc","Reset"]].map(([k, label]) => (
                <div key={k} className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span className="text-zinc-400">{label}</span>
                  <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-zinc-200">{k}</kbd>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => setShortcutsOpen(false)}>Got it</Button>
          </div>
        </div>
      )}

      {/* Open shift dialog */}
      <Dialog open={openShiftDialog} onOpenChange={(v) => { if (!v && currentShift) setOpenShiftDialog(false); }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader><DialogTitle className="text-2xl font-black">OPEN SHIFT</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-zinc-400">Count the cash in the drawer and enter the opening float. This becomes the starting balance for the day.</p>
            <div>
              <label className="text-xs uppercase font-black text-zinc-500">Opening cash (₹)</label>
              <Input
                type="number" inputMode="decimal" autoFocus
                className="h-14 text-2xl font-bold bg-zinc-900 border-zinc-800"
                value={openingCash} onChange={(e) => setOpeningCash(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleOpenShift(); }}
                data-testid="open-shift-cash"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleOpenShift} disabled={openingShift || !openingCash} data-testid="open-shift-confirm">
              {openingShift ? "Opening..." : "OPEN SHIFT"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close shift / Z-report dialog */}
      <Dialog open={closeShiftOpen} onOpenChange={(v) => { setCloseShiftOpen(v); if (!v) { setZReport(null); setCountedCash(""); setClosingNotes(""); } }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-black">{zReport ? "Z-REPORT" : "CLOSE SHIFT"}</DialogTitle></DialogHeader>

          {!zReport && currentShift && running && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-zinc-900 border border-zinc-800 rounded p-3">
                <div className="text-zinc-500">Opening float</div><div className="text-right font-bold">{inr(Number(currentShift.openingCash) || 0)}</div>
                <div className="text-zinc-500">Cash sales</div><div className="text-right font-bold">{inr(running.cashSales || 0)}</div>
                <div className="text-zinc-500">UPI sales</div><div className="text-right font-bold">{inr(running.upiSales || 0)}</div>
                <div className="text-zinc-500">Card sales</div><div className="text-right font-bold">{inr(running.cardSales || 0)}</div>
                <div className="text-zinc-500">Credit sales</div><div className="text-right font-bold">{inr(running.creditSales || 0)}</div>
                <div className="text-zinc-500">Transactions</div><div className="text-right font-bold">{running.txnCount || 0}</div>
                <div className="text-emerald-400 font-black col-span-2 border-t border-zinc-800 pt-2 flex justify-between">
                  <span>Expected drawer</span><span>{inr(running.expectedCash || 0)}</span>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase font-black text-zinc-500">Counted cash (₹)</label>
                <Input
                  type="number" inputMode="decimal" autoFocus
                  className="h-14 text-2xl font-bold bg-zinc-900 border-zinc-800"
                  value={countedCash} onChange={(e) => setCountedCash(e.target.value)}
                  data-testid="close-shift-counted"
                />
              </div>
              <Input
                placeholder="Notes (optional)"
                className="bg-zinc-900 border-zinc-800"
                value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)}
              />
            </div>
          )}

          {zReport && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-zinc-900 border border-zinc-800 rounded p-3">
                <div className="text-zinc-500">Transactions</div><div className="text-right font-bold">{zReport.txnCount}</div>
                <div className="text-zinc-500">Total sales</div><div className="text-right font-bold">{inr(zReport.totalSales)}</div>
                <div className="text-zinc-500">Cash</div><div className="text-right">{inr(zReport.cashSales)}</div>
                <div className="text-zinc-500">UPI</div><div className="text-right">{inr(zReport.upiSales)}</div>
                <div className="text-zinc-500">Card</div><div className="text-right">{inr(zReport.cardSales)}</div>
                <div className="text-zinc-500">Credit</div><div className="text-right">{inr(zReport.creditSales)}</div>
                <div className="text-zinc-500 border-t border-zinc-800 pt-2">Opening float</div><div className="text-right font-bold border-t border-zinc-800 pt-2">{inr(zReport.openingCash)}</div>
                <div className="text-zinc-500">Expected cash</div><div className="text-right font-bold">{inr(zReport.expectedCash)}</div>
                <div className="text-zinc-500">Counted cash</div><div className="text-right font-bold">{inr(zReport.closingCash)}</div>
                <div className={`font-black col-span-2 border-t border-zinc-800 pt-2 flex justify-between ${zReport.overShort < -0.5 ? "text-red-500" : zReport.overShort > 0.5 ? "text-amber-400" : "text-emerald-400"}`}>
                  <span>{zReport.overShort < 0 ? "Short" : "Over"} / Variance</span><span>{inr(Math.abs(zReport.overShort))}</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500">Closed at {new Date(zReport.closedAt).toLocaleString()}.</p>
            </div>
          )}

          <DialogFooter>
            {!zReport && (
              <Button onClick={handleCloseShift} disabled={closingShift || !countedCash} data-testid="close-shift-confirm">
                {closingShift ? "Closing..." : "CLOSE SHIFT"}
              </Button>
            )}
            {zReport && (
              <>
                <Button variant="outline" onClick={() => window.print()}>Print</Button>
                <Button onClick={handleZReportDone} data-testid="z-report-done">DONE — LOG OUT</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint dialog */}
      <Dialog open={reprintOpen} onOpenChange={setReprintOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-black">REPRINT RECEIPT</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentSales.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">No recent sales</p>}
            {recentSales.map((s) => (
              <button
                key={s.id}
                onClick={() => { setReprintOpen(false); setLocation(`/receipt?id=${s.id}`); }}
                className="w-full text-left p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded flex items-center justify-between"
                data-testid={`reprint-${s.id}`}
              >
                <div>
                  <p className="font-bold text-sm">{s.invoiceNo}</p>
                  <p className="text-xs text-zinc-500">{s.customerName ?? "Walk-in"} • {s.itemCount} items • {new Date(s.createdAt).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black">{inr(s.total)}</p>
                  <p className="text-xs text-zinc-500">{s.paymentMode}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ScannerSettingsDialog open={scannerSettingsOpen} onOpenChange={setScannerSettingsOpen} />
    </div>
  );
};

export default SaleScreen;
