import { Link, useLocation } from "wouter";
import { useCart } from "@/context/cart";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Menu, X, Phone, Sparkles } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { totalItems } = useCart();
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/catalogue", label: "Catalogue" },
    { href: "/help", label: "Help" },
  ];

  return (
    <>
      {/* Top promo bar */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-200 animate-pulse" />
            <span className="font-medium tracking-wide">Diwali Offers Live · Free GST Invoice · Pan-India Delivery</span>
          </div>
          <a href="tel:+919876543210" className="hidden sm:flex items-center gap-1.5 hover:text-amber-200 transition-colors">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-semibold">+91 98765 43210</span>
          </a>
        </div>
      </div>

      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-2xl font-extrabold bg-gradient-to-r from-red-600 to-amber-500 bg-clip-text text-transparent">
                  🎆 RATHINAM
                </span>
                <span className="hidden sm:inline text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase pt-0.5">Crackers · Est. 1985</span>
              </Link>
            </div>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-red-600 ${
                    location === link.href ? "text-red-600" : "text-gray-600"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://wa.me/919876543210?text=Hi%20Rathinam%20Crackers%2C%20I%27d%20like%20to%20enquire%20about%20bulk%20orders"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
              >
                Bulk Orders
              </a>
              <Link href="/cart">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-4">
              <Link href="/cart">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {totalItems}
                    </span>
                  )}
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 py-4 px-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  location === link.href ? "bg-red-50 text-red-600" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 rounded-md text-base font-medium text-green-700 hover:bg-green-50"
            >
              Bulk Orders (WhatsApp)
            </a>
          </div>
        )}
      </nav>
    </>
  );
}
