import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { 
  BarChart3, Box, Package, Users, UsersRound, Truck, 
  ShoppingCart, Tags, FileText, FileBarChart, Settings, LogOut,
  HelpCircle, ShieldCheck, Globe, MessageSquare, Award, UserCircle2
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import logoUrl from "@assets/rathinam_logo.png";

const navItems = [
  { icon: BarChart3, label: "Dashboard", href: "/" },
  { icon: BarChart3, label: "Locations", href: "/dashboard/locations" },
  { icon: BarChart3, label: "Business Overview", href: "/dashboard/business" },
  { icon: Box, label: "Products", href: "/products" },
  { icon: Award, label: "Brands", href: "/brands" },
  { icon: Package, label: "Stock", href: "/stock" },
  { icon: FileText, label: "Estimates", href: "/estimates" },
  { icon: FileText, label: "Invoices", href: "/invoices" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Truck, label: "Suppliers", href: "/suppliers" },
  { icon: UsersRound, label: "Agents", href: "/agents" },
  { icon: ShoppingCart, label: "Purchase Orders", href: "/purchase-orders" },
  { icon: Truck, label: "Transfers", href: "/transfers" },
  { icon: Tags, label: "Coupons", href: "/coupons" },
];

const reportItems = [
  { label: "Sales", href: "/reports/sales" },
  { label: "Outstanding", href: "/reports/outstanding" },
  { label: "Commission", href: "/reports/commission" },
  { label: "GST", href: "/reports/gst" },
  { label: "Activity log", href: "/reports/activity" },
];

const settingsItems = [
  { label: "Users", href: "/users" },
  { label: "Roles & Permissions", href: "/system/roles" },
  { label: "Locations", href: "/locations" },
  { label: "Website Content", href: "/site-content" },
  { label: "Product Reviews", href: "/reviews" },
  { label: "General Settings", href: "/settings" },
];

const helpItems = [
  { label: "Help & Guide", href: "/help", icon: HelpCircle },
  { label: "System Verifier", href: "/verifier", icon: ShieldCheck },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-sidebar-border bg-sidebar-accent/40">
          <img src={logoUrl} alt="" className="h-9 w-9 rounded bg-white/95 p-0.5 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-sm text-sidebar-foreground tracking-wide">RATHINAM</span>
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-300/90">ERP Console</span>
          </div>
        </div>
        
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location === item.href || (item.href !== "/" && location.startsWith(item.href))
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Reports
            </div>
            {reportItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <FileBarChart className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              System
            </div>
            {settingsItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Settings className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Resources
            </div>
            {helpItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  location === item.href || (item.href === "/help" && location.startsWith("/help"))
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link
            href="/profile"
            data-testid="nav-profile"
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              location === "/profile"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <UserCircle2 className="h-4 w-4" />
            My Profile
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/80 hover:bg-destructive hover:text-destructive-foreground w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <ScrollArea className="flex-1">
          <div className="p-6 md:p-8">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
