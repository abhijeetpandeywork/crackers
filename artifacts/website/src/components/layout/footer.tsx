export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-bold text-white mb-4">Rathinam Crackers</h2>
            <p className="text-sm leading-relaxed max-w-md">
              Premium Sivakasi Fireworks Since 1985. We bring joy and sparkles to your celebrations with the highest quality crackers and fireworks.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="hover:text-amber-500 transition-colors">Home</a></li>
              <li><a href="/catalogue" className="hover:text-amber-500 transition-colors">Catalogue</a></li>
              <li><a href="/cart" className="hover:text-amber-500 transition-colors">Shopping Cart</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm">
              <li>123 Fireworks Street, Sivakasi, Tamil Nadu</li>
              <li>Phone: +91 98765 43210</li>
              <li>Email: info@rathinamcrackers.com</li>
              <li>GST: 33AAAAA0000A1Z5</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center">
          <p>&copy; {new Date().getFullYear()} Rathinam Crackers. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
