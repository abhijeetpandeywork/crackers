import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import StockLevels from "@/pages/stock";
import ReceiveStock from "@/pages/receive";
import StockAdjust from "@/pages/adjust";
import Transfers from "@/pages/transfers";
import NewTransfer from "@/pages/transfers-new";
import StockLedger from "@/pages/ledger";
import NotFound from "@/pages/not-found";

// Setup API client auth
setAuthTokenGetter(() => localStorage.getItem("wh_token"));

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route path="/stock" component={StockLevels} />
        <Route path="/receive" component={ReceiveStock} />
        <Route path="/adjust" component={StockAdjust} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/transfers/new" component={NewTransfer} />
        <Route path="/ledger" component={StockLedger} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
