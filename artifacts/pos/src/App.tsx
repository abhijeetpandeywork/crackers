import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/cart";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import PinLogin from "@/pages/pin-login";
import SaleScreen from "@/pages/sale";
import ReceiptScreen from "@/pages/receipt";
import NotFound from "@/pages/not-found";

setAuthTokenGetter(() => localStorage.getItem("pos_token"));

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={PinLogin} />
      <Route path="/sale" component={SaleScreen} />
      <Route path="/receipt" component={ReceiptScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <div className="dark min-h-screen bg-[#0d0d0d] text-white">
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </div>
          <Toaster />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
