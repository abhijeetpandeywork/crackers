import { Link } from "wouter";
import { Phone, Mail, MapPin, ShieldCheck, Award, Truck, FileCheck, MessageCircle, Instagram, Facebook, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-gray-900 to-black text-gray-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-10 mb-10 border-b border-gray-800">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">PESO Licensed</p>
              <p className="text-xs text-gray-500">Govt. of India approved</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Award className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">40+ Years</p>
              <p className="text-xs text-gray-500">Trusted since 1985</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">Pan-India Delivery</p>
              <p className="text-xs text-gray-500">Licensed logistics only</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileCheck className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">GST Invoice</p>
              <p className="text-xs text-gray-500">B2B & B2C compliant</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand column */}
          <div className="md:col-span-5">
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent mb-4">
              🎆 Rathinam Crackers
            </h2>
            <p className="text-sm leading-relaxed text-gray-400 mb-5 max-w-md">
              Premium Sivakasi fireworks since 1985. Three generations of cracker craftsmanship, delivering safe and brilliant celebrations to every Indian home.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-green-600/20 hover:bg-green-600/40 flex items-center justify-center text-green-400 transition-colors" aria-label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full bg-pink-600/20 hover:bg-pink-600/40 flex items-center justify-center text-pink-400 transition-colors" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full bg-blue-600/20 hover:bg-blue-600/40 flex items-center justify-center text-blue-400 transition-colors" aria-label="Facebook">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-full bg-red-600/20 hover:bg-red-600/40 flex items-center justify-center text-red-400 transition-colors" aria-label="YouTube">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Shop links */}
          <div className="md:col-span-2">
            <h3 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/catalogue" className="hover:text-amber-400 transition-colors">All Crackers</Link></li>
              <li><Link href="/catalogue?category=Aerial" className="hover:text-amber-400 transition-colors">Aerial</Link></li>
              <li><Link href="/catalogue?category=Ground" className="hover:text-amber-400 transition-colors">Ground</Link></li>
              <li><Link href="/catalogue?category=Sparkler" className="hover:text-amber-400 transition-colors">Sparklers</Link></li>
              <li><Link href="/catalogue?category=Gift Box" className="hover:text-amber-400 transition-colors">Gift Boxes</Link></li>
              <li><Link href="/catalogue?category=Bundle" className="hover:text-amber-400 transition-colors">Family Bundles</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h3 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/help" className="hover:text-amber-400 transition-colors">Help &amp; FAQ</Link></li>
              <li><Link href="/help" className="hover:text-amber-400 transition-colors">Safety Guide</Link></li>
              <li><Link href="/help" className="hover:text-amber-400 transition-colors">Bulk Orders</Link></li>
              <li><Link href="/help" className="hover:text-amber-400 transition-colors">Wedding &amp; Events</Link></li>
              <li><Link href="/help" className="hover:text-amber-400 transition-colors">Returns &amp; Refunds</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h3 className="text-white font-semibold mb-4 text-sm tracking-wider uppercase">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>123 Fireworks Street,<br />Sivakasi, Tamil Nadu 626 123</span>
              </li>
              <li className="flex gap-2">
                <Phone className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <a href="tel:+919876543210" className="hover:text-amber-400 transition-colors">+91 98765 43210</a>
              </li>
              <li className="flex gap-2">
                <Mail className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <a href="mailto:info@rathinamcrackers.com" className="hover:text-amber-400 transition-colors break-all">info@rathinamcrackers.com</a>
              </li>
              <li className="text-xs text-gray-500 pt-1">GSTIN: 33AAAAA0000A1Z5</li>
            </ul>
          </div>
        </div>

        {/* Payment & legal strip */}
        <div className="mt-12 pt-6 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Rathinam Crackers Pvt. Ltd. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-400 font-medium">We accept:</span>
            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded">UPI</span>
            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded">Net Banking</span>
            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded">NEFT/RTGS</span>
            <span className="px-2 py-1 bg-white/5 border border-white/10 rounded">Cash on Delivery</span>
          </div>
        </div>

        <p className="mt-6 text-[10px] text-gray-600 text-center max-w-3xl mx-auto leading-relaxed">
          Fireworks are dangerous if mishandled. Use only under adult supervision. Read safety instructions on each box. Sale and use of fireworks are subject to local laws and Supreme Court guidelines on permissible noise and emissions.
        </p>
      </div>
    </footer>
  );
}
