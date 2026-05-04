import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, Box, Package, Users, UsersRound, Truck, 
  ShoppingCart, Tags, FileText, FileBarChart, Settings, LogOut, ShoppingBag,
  HelpCircle, ShieldCheck, MessageSquare, Award, UserCircle2, RotateCcw,
  Menu
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import logoUrl from "@assets/rathinam_logo.png";

const navItems = [
  { icon: BarChart3, label: "Dashboard", href: "/" },
  { icon: BarChart3, label: "Locations Overview", href: "/dashboard/locations" },
  { icon: BarChart3, label: "Business Overview", href: "/dashboard/business" },
  { icon: Box, label: "Products", href: "/products" },
  { icon: Award, label: "Brands", href: "/brands" },
  { icon: Tags, label: "Categories", href: "/categories" },
  { icon: Package, label: "Stock", href: "/stock" },
  { icon: FileText, label: "Estimates", href: "/estimates" },
  { icon: FileText, label: "Invoices", href: "/invoices" },
  { icon: ShoppingBag, label: "Online Orders", href: "/orders" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Truck, label: "Suppliers", href: "/suppliers" },
  { icon: UsersRound, label: "Agents", href: "/agents" },
  { icon: ShoppingCart, label: "Purchase Orders", href: "/purchase-orders" },
  { icon: Truck, label: "Transfers", href: "/transfers" },
  { icon: Tags, label: "Coupons", href: "/coupons" },
  { icon: RotateCcw, label: "Returns", href: "/returns" },
];

const reportItems = [
  { label: "Sales", href: "/reports/sales" },
  { label: "Day Book", href: "/reports/daybook" },
  { label: "Outstanding", href: "/reports/outstanding" },
  { label: "Commission", href: "/reports/commission" },
  { label: "GST", href: "/reports/gst" },
  { label: "Returns", href: "/reports/returns" },
  { label: "Damage", href: "/reports/damage" },
  { label: "Loyalty", href: "/reports/loyalty" },
  { label: "Activity log", href: "/reports/activity" },
];

const settingsItems = [
  { label: "Users", href: "/users" },
  { label: "Roles & Permissions", href: "/system/roles" },
  { label: "API Access", href: "/system/api-docs" },
  { label: "Notifications", href: "/system/notifications" },
  { label: "Locations", href: "/locations" },
  { label: "Website Content", href: "/site-content" },
  { label: "Product Reviews", href: "/reviews" },
  { label: "General Settings", href: "/settings" },
];

const helpItems = [
  { label: "Help & Guide", href: "/help", icon: HelpCircle },
  { label: "System Verifier", href: "/verifier", icon: ShieldCheck },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-sidebar-border bg-sidebar-accent/40 shrink-0">
        <img src={logoUrl} alt="" className="h-9 w-9 rounded bg-white/95 p-0.5 object-contain" />
        <div className="flex flex-col leading-tight">
          <span className="font-extrabold text-sm text-sidebar-foreground tracking-wide">RATHINAM</span>
          <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-300/90">ERP Console</span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate} className={linkCls(active)}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Reports</div>
          {reportItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={linkCls(location === item.href)}>
              <FileBarChart className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}

          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">System</div>
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={linkCls(location === item.href)}>
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}

          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Resources</div>
          {helpItems.map((item) => {
            const active = location === item.href || (item.href === "/help" && location.startsWith("/help"));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={linkCls(active)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border space-y-1 shrink-0">
        <Link
          href="/profile"
          onClick={onNavigate}
          data-testid="nav-profile"
          className={linkCls(location === "/profile")}
        >
          <UserCircle2 className="h-4 w-4 shrink-0" />
          My Profile
        </Link>
        <button
          onClick={() => { onNavigate?.(); logout(); }}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/80 hover:bg-destructive hover:text-destructive-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Persistent sidebar on lg+ */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 border-r bg-sidebar text-sidebar-foreground flex-col">
        <SidebarNav />
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden h-14 flex items-center gap-2 px-3 border-b bg-sidebar text-sidebar-foreground shrink-0">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" data-testid="mobile-nav-trigger">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <img src={logoUrl} alt="" className="h-8 w-8 rounded bg-white/95 p-0.5 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-xs tracking-wide">RATHINAM</span>
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-amber-300/90">ERP Console</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-6 md:p-8">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
