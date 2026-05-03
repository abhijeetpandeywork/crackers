import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetPosProducts,
  useHoldBill,
  useListHeldBills,
  useValidateCoupon,
  usePosCreateSale,
  useCloseShift,
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
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Pause,
  History,
  LogOut,
  User,
  UserX,
  HelpCircle,
  ScanLine,
  Keyboard,
  Settings2,
} from "lucide-react";
import ScannerSettingsDialog from "@/components/pos/scanner-settings-dialog";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const categories = ["All", "Ground", "Aerial", "Sparkler", "Gift Box", "Bundle"];
const QUICK_CASH = [100, 200, 500, 1000, 2000];

type Variant = {
  variantId?: string;
  id?: string;
  size?: string;
  label?: string;
  price?: number | string;
  stock?: number;
};

type Product = {
  id: string;
  code?: string;
  name: string;
  category?: string;
  variants?: Variant[];
};

const SaleScreen = () => {
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [activeLocationId, setActiveLocationId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [heldBillsOpen, setHeldBillsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [scannerSettingsOpen, setScannerSettingsOpen] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const {
    items, addItem, removeItem, updateQty, clearCart, loadHeldBill,
    subtotal, gst, discount, total,
    coupon, applyCoupon, customer, setCustomer,
  } = useCart();

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
  const { mutate: closeShift } = useCloseShift();
  const { data: customersData } = useListCustomers(
    { search: customerSearch || undefined, limit: 10 },
    { query: { enabled: customerSearch.length >= 2, queryKey: ["customers", customerSearch] } },
  );

  const products: Product[] = (productsData?.data ?? []) as Product[];
  const heldBills = heldBillsResponse?.data || [];

  // -------- Filters: actually apply search + category to product list --------
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk =
        activeCategory === "All" ||
        (p.category && p.category.toLowerCase() === activeCategory.toLowerCase());
      if (!catOk) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.code ?? "").toLowerCase().includes(term)
      );
    });
  }, [products, search, activeCategory]);

  // -------- Helpers --------
  const variantPrice = (v: Variant) => Number(v.price) || 0;
  const variantId = (v: Variant) => v.variantId ?? v.id ?? "";
  const variantLabel = (v: Variant) => v.size ?? v.label ?? "Standard";

  const addVariantToCart = useCallback(
    (product: Product, variant: Variant) => {
      const stock = typeof variant.stock === "number" ? variant.stock : Infinity;
      if (stock <= 0) {
        toast({ title: "Out of stock", description: `${product.name} (${variantLabel(variant)})`, variant: "destructive" });
        return;
      }
      addItem({
        productId: product.id,
        variantId: variantId(variant),
        productName: product.name,
        variantLabel: variantLabel(variant),
        qty: 1,
        unitPrice: variantPrice(variant),
      });
    },
    [addItem, toast],
  );

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    validateCoupon(
      { data: { code: couponCode, cartTotal: subtotal } },
      {
        onSuccess: (res) => {
          if (res.data?.valid) {
            applyCoupon({
              code: couponCode,
              type: "PERCENT",
              value: res.data.discountAmount || 0,
            });
            toast({ title: "Coupon applied" });
          } else {
            toast({ title: res.data?.error || "Invalid coupon", variant: "destructive" });
          }
        },
        onError: () => toast({ title: "Error validating coupon", variant: "destructive" }),
      },
    );
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    if (paymentMethod === "CASH" && (parseFloat(cashReceived) || 0) < total) {
      toast({ title: "Cash received is less than total", variant: "destructive" });
      cashRef.current?.focus();
      return;
    }
    createSale(
      {
        data: {
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          paymentMode: paymentMethod,
          locationId: activeLocationId,
          couponCode: coupon?.code,
          customerId: customer?.id,
        },
      },
      {
        onSuccess: (res) => {
          if (res.data?.invoice?.id) {
            const change = paymentMethod === "CASH" ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;
            setLocation(`/receipt?id=${res.data.invoice.id}&change=${change.toFixed(2)}&received=${cashReceived || ""}`);
          }
        },
        onError: (err) => toast({ title: "Checkout failed", description: (err as any).message, variant: "destructive" }),
      },
    );
  };

  const handleHoldBill = () => {
    if (items.length === 0) {
      toast({ title: "Nothing to hold" });
      return;
    }
    holdBill(
      {
        data: {
          locationId: activeLocationId,
          customerId: customer?.id,
          items: items.map((i: CartItem) => ({
            productId: i.productId,
            variantId: i.variantId,
            productName: i.productName,
            variantLabel: i.variantLabel,
            qty: i.qty,
            unitPrice: i.unitPrice,
          })),
          coupon: coupon ? ({ ...coupon } as Record<string, unknown>) : undefined,
        },
      },
      {
        onSuccess: () => {
          clearCart();
          refetchHeldBills();
          toast({ title: "Bill held" });
        },
      },
    );
  };

  type ResumableHeldBill = {
    items?: Array<{ productId?: string; variantId?: string; productName?: string; variantLabel?: string; qty?: number; unitPrice?: number }>;
    customer?: unknown;
    coupon?: CouponData | null;
  };
  const handleResumeBill = (bill: ResumableHeldBill) => {
    const billItems = (bill.items ?? []).map((i) => ({
      productId: i.productId ?? "",
      variantId: i.variantId ?? "",
      productName: i.productName ?? "Item",
      variantLabel: i.variantLabel ?? "",
      qty: i.qty ?? 1,
      unitPrice: i.unitPrice ?? 0,
    }));
    loadHeldBill({ items: billItems, customer: bill.customer ?? null, coupon: bill.coupon ?? null });
    setHeldBillsOpen(false);
    toast({ title: "Bill resumed", description: `Loaded ${billItems.length} items` });
  };

  const handleCloseShift = () => {
    closeShift(
      { data: { shiftId: "shift1", closingCash: 0 } },
      {
        onSuccess: () => {
          localStorage.removeItem("pos_token");
          setLocation("/");
          toast({ title: "Shift closed" });
        },
      },
    );
  };

  // -------- Barcode / quick-add --------
  // The barcode field is auto-focused; scanners type the product code and press Enter.
  // On Enter we resolve the code (case-insensitive) and add the first available variant.
  const handleBarcodeSubmit = () => {
    const code = barcode.trim();
    if (!code) return;
    const match = products.find(
      (p) => (p.code ?? "").toLowerCase() === code.toLowerCase(),
    );
    if (!match) {
      toast({ title: "No product matches that code", variant: "destructive" });
      return;
    }
    const variants = match.variants ?? [];
    const inStock = variants.find((v) => (typeof v.stock === "number" ? v.stock > 0 : true)) ?? variants[0];
    if (!inStock) {
      toast({ title: `${match.name} has no variants`, variant: "destructive" });
      return;
    }
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
      setSearch("");
      setBarcode("");
      barcodeRef.current?.focus();
    },
  });

  // Auto-focus barcode field on mount and after each successful add.
  useEffect(() => {
    barcodeRef.current?.focus();
  }, [items.length]);

  // ---- Global HID scanner ----
  // Catches barcode scans typed by USB-HID and Bluetooth scanners *anywhere*
  // on the sale screen — even if no field is focused. Tuned by the cashier
  // via the Scanner Settings dialog. Disabled while the settings dialog is
  // open so the dialog's own test scanner has exclusive capture.
  useBarcodeScanner({
    enabled: !scannerSettingsOpen,
    onScan: ({ code }) => {
      const match = products.find(
        (p) => (p.code ?? "").toLowerCase() === code.toLowerCase(),
      );
      if (!match) {
        toast({ title: "No product matches that scan", description: code, variant: "destructive" });
        return;
      }
      const variants = match.variants ?? [];
      const inStock = variants.find((v) => (typeof v.stock === "number" ? v.stock > 0 : true)) ?? variants[0];
      if (!inStock) {
        toast({ title: `${match.name} has no variants`, variant: "destructive" });
        return;
      }
      addVariantToCart(match, inStock);
      setBarcode("");
    },
  });

  const change = paymentMethod === "CASH" ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;
  const cashShort = paymentMethod === "CASH" && cashReceived !== "" && (parseFloat(cashReceived) || 0) < total;

  const setExactCash = () => setCashReceived(Math.ceil(total).toString());
  const addCash = (amt: number) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived((current + amt).toString());
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d]">
      {/* Left Panel: Products */}
      <div className="w-[60%] flex flex-col border-r border-zinc-800">
        <div className="p-4 space-y-3">
          {/* Top row: barcode (primary) + close shift */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
              <Input
                ref={barcodeRef}
                placeholder="Scan barcode or type product code, then press Enter  (F3)"
                className="pl-10 h-14 bg-zinc-900 border-primary/40 text-lg focus-visible:ring-primary"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleBarcodeSubmit();
                  }
                }}
                data-testid="pos-barcode-input"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 border-zinc-800"
              onClick={() => setScannerSettingsOpen(true)}
              title="Barcode scanner settings"
              data-testid="pos-scanner-settings-btn"
            >
              <Settings2 className="h-6 w-6 text-primary" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 border-zinc-800"
              onClick={() => setShortcutsOpen(true)}
              title="Keyboard shortcuts (?)"
              data-testid="pos-shortcuts-btn"
            >
              <Keyboard className="h-6 w-6 text-blue-400" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 border-zinc-800"
              onClick={handleCloseShift}
              title="End shift"
            >
              <LogOut className="h-6 w-6 text-red-500" />
            </Button>
          </div>

          {/* Secondary search filters product grid */}
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
                            key={variantId(variant)}
                            variant="secondary"
                            size="sm"
                            disabled={oos}
                            className={`text-xs h-10 bg-zinc-800 hover:bg-primary hover:text-white relative ${oos ? "opacity-40 cursor-not-allowed" : ""}`}
                            onClick={() => addVariantToCart(product, variant)}
                            title={oos ? "Out of stock" : low ? `Only ${stock} left` : `${stock ?? "?"} in stock`}
                          >
                            <span className="font-bold">{variantLabel(variant)}</span>
                            <span className="ml-2">₹{variantPrice(variant)}</span>
                            {low && (
                              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 rounded-full bg-amber-500 text-[10px] text-black font-black px-1 leading-4">{stock}</span>
                            )}
                            {oos && (
                              <span className="absolute -top-1.5 -right-1.5 h-4 px-1 rounded-full bg-red-600 text-[10px] text-white font-black leading-4">OUT</span>
                            )}
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

        {/* Shortcut hint bar */}
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
                <SheetHeader>
                  <SheetTitle className="text-white text-2xl font-black">HELD BILLS</SheetTitle>
                </SheetHeader>
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
                      <Button size="sm" onClick={() => handleResumeBill(bill)} data-testid={`resume-${bill.id}`}>
                        Resume
                      </Button>
                    </div>
                  ))}
                  {!heldBills.length && <p className="text-center text-zinc-600 py-8">No held bills</p>}
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="icon" className="border-zinc-800 text-amber-500" onClick={handleHoldBill} title="Hold bill (F9)">
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
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-md">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)} title="Decrease">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)} title="Increase">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-black text-lg">₹{item.lineTotal.toLocaleString("en-IN")}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-red-500" onClick={() => removeItem(item.productId, item.variantId)} title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-700">
                <ScanLine className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-xl font-bold">Cart is empty</p>
                <p className="text-sm text-zinc-600 mt-2">Scan a barcode or tap a product to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Coupon code"
              className="h-11 bg-zinc-950 border-zinc-800"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <Button variant="secondary" className="h-11 px-6" onClick={handleApplyCoupon} disabled={validatingCoupon || !couponCode}>
              APPLY
            </Button>
          </div>

          {/* Customer picker */}
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
                  ) : (
                    <span className="text-zinc-500">Walk-in customer  (F4)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] bg-zinc-950 border-zinc-800 p-0" align="start">
                <div className="p-3 border-b border-zinc-800">
                  <Input
                    autoFocus
                    placeholder="Search by name or phone…"
                    className="bg-zinc-900 border-zinc-800 h-10"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    data-testid="customer-search-input"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {customerSearch.length < 2 && (
                    <p className="text-xs text-zinc-500 p-3">Type at least 2 characters to search</p>
                  )}
                  {customerSearch.length >= 2 && (customersData?.data ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500 p-3">No customers match. Leave blank for walk-in.</p>
                  )}
                  {(customersData?.data ?? []).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); setCustomerSearch(""); setCustomerOpen(false); }}
                      className="w-full text-left p-3 hover:bg-zinc-900 border-b border-zinc-900"
                      data-testid={`customer-option-${c.id}`}
                    >
                      <p className="font-bold text-sm">{c.name}</p>
                      <p className="text-xs text-zinc-500">{c.phone} {c.customerType ? `• ${c.customerType}` : ""}</p>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {customer && (
              <Button variant="outline" size="icon" className="h-11 w-11 border-zinc-800 text-red-400" onClick={() => setCustomer(null)} data-testid="clear-customer" title="Clear customer">
                <UserX className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5 text-zinc-400 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Discount {coupon ? `(${coupon.code})` : ""}</span>
                <span>- ₹{discount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>GST (18%)</span>
              <span>₹{gst.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-white text-3xl font-black pt-2 border-t border-zinc-800">
              <span>TOTAL</span>
              <span className="text-primary">₹{Math.round(total).toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["CASH", "CARD", "UPI"] as const).map((method) => (
              <Button
                key={method}
                variant={paymentMethod === method ? "default" : "outline"}
                className={`h-14 text-base font-bold border-zinc-800 ${paymentMethod === method ? "bg-primary text-white" : "bg-zinc-950"}`}
                onClick={() => setPaymentMethod(method)}
                data-testid={`payment-${method.toLowerCase()}`}
              >
                {method}
              </Button>
            ))}
          </div>

          {paymentMethod === "CASH" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {QUICK_CASH.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-sm font-bold"
                    onClick={() => addCash(amt)}
                    data-testid={`quick-cash-${amt}`}
                  >
                    +₹{amt}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 border-primary/40 bg-zinc-950 hover:bg-primary/20 text-sm font-bold text-primary"
                  onClick={setExactCash}
                  data-testid="quick-cash-exact"
                >
                  Exact ₹{Math.ceil(total).toLocaleString("en-IN")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-zinc-500 hover:text-white"
                  onClick={() => setCashReceived("")}
                  title="Clear"
                >
                  Clear
                </Button>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Cash received</label>
                  <Input
                    ref={cashRef}
                    type="number"
                    inputMode="decimal"
                    className={`h-12 text-xl font-black bg-zinc-950 border-zinc-800 ${cashShort ? "border-red-500" : ""}`}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    data-testid="cash-received-input"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Change</label>
                  <div className={`h-12 text-xl font-black flex items-center justify-end pr-3 bg-zinc-950 border rounded-md ${cashShort ? "border-red-500 text-red-500" : "border-zinc-800 text-green-500"}`}>
                    ₹{change.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
              {cashShort && (
                <p className="text-xs text-red-500 font-bold">
                  Short by ₹{(total - (parseFloat(cashReceived) || 0)).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full h-16 text-xl font-black rounded-xl shadow-lg shadow-primary/20"
            disabled={items.length === 0 || (paymentMethod === "CASH" && (parseFloat(cashReceived) || 0) < total) || checkingOut}
            onClick={handleCheckout}
            data-testid="pos-checkout-btn"
          >
            {checkingOut ? "PROCESSING..." : `CHECKOUT  •  ₹${Math.round(total).toLocaleString("en-IN")}`}
          </Button>
        </div>
      </div>

      {/* Shortcuts overlay */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black">KEYBOARD SHORTCUTS</h2>
            <div className="space-y-2 text-sm">
              {[
                ["F2", "Focus product search"],
                ["F3", "Focus barcode / quick-add"],
                ["F4", "Open customer picker"],
                ["F9", "Hold current bill"],
                ["F12", "Complete checkout"],
                ["?", "Toggle this help"],
                ["Esc", "Reset / close popovers"],
              ].map(([k, label]) => (
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

      <ScannerSettingsDialog open={scannerSettingsOpen} onOpenChange={setScannerSettingsOpen} />
    </div>
  );
};

export default SaleScreen;
