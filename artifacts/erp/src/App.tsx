import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import LocationsDashboard from "@/pages/dashboard/locations";
import BusinessOverview from "@/pages/dashboard/business";
import ProductsList from "@/pages/products/index";
import ProductDetail from "@/pages/products/[id]";
import BrandsList from "@/pages/brands/index";
import Stock from "@/pages/stock/index";
import StockLedger from "@/pages/stock/ledger";

import EstimatesList from "@/pages/estimates/index";
import NewEstimate from "@/pages/estimates/new";
import EstimateDetail from "@/pages/estimates/[id]";
import InvoicesList from "@/pages/invoices/index";
import InvoiceDetail from "@/pages/invoices/[id]";
import CustomersList from "@/pages/customers/index";
import CustomerDetail from "@/pages/customers/[id]";
import SuppliersList from "@/pages/suppliers/index";
import SupplierDetail from "@/pages/suppliers/[id]";
import AgentsList from "@/pages/agents/index";
import AgentDetail from "@/pages/agents/[id]";
import PurchaseOrdersList from "@/pages/purchase-orders/index";
import NewPurchaseOrder from "@/pages/purchase-orders/new";
import PurchaseOrderDetail from "@/pages/purchase-orders/[id]";
import TransfersList from "@/pages/transfers/index";
import NewTransfer from "@/pages/transfers/new";
import TransferDetail from "@/pages/transfers/[id]";
import CouponsList from "@/pages/coupons/index";
import SalesReport from "@/pages/reports/sales";
import OutstandingReport from "@/pages/reports/outstanding";
import CommissionReport from "@/pages/reports/commission";
import GstReport from "@/pages/reports/gst";
import ActivityReport from "@/pages/reports/activity";
import UsersList from "@/pages/users/index";
import LocationsList from "@/pages/locations/index";
import Settings from "@/pages/settings/index";
import RolesPage from "@/pages/system/roles";
import ProfilePage from "@/pages/profile";
import SiteContent from "@/pages/site-content/index";
import ReviewsModeration from "@/pages/reviews/index";
import HelpIndex from "@/pages/help/index";
import HelpTopic from "@/pages/help/topic";
import Verifier from "@/pages/verifier";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { token } = useAuth();
  
  if (!token) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {(params) => <ProtectedRoute component={Dashboard} {...params} />}
      </Route>
      <Route path="/dashboard/locations">
        {(params) => <ProtectedRoute component={LocationsDashboard} {...params} />}
      </Route>
      <Route path="/dashboard/business">
        {(params) => <ProtectedRoute component={BusinessOverview} {...params} />}
      </Route>
      <Route path="/products">
        {(params) => <ProtectedRoute component={ProductsList} {...params} />}
      </Route>
      <Route path="/products/:id">
        {(params) => <ProtectedRoute component={ProductDetail} {...params} />}
      </Route>
      <Route path="/brands">
        {(params) => <ProtectedRoute component={BrandsList} {...params} />}
      </Route>
      <Route path="/stock">
        {(params) => <ProtectedRoute component={Stock} {...params} />}
      </Route>
      <Route path="/stock/ledger">
        {(params) => <ProtectedRoute component={StockLedger} {...params} />}
      </Route>
      <Route path="/estimates">
        {(params) => <ProtectedRoute component={EstimatesList} {...params} />}
      </Route>
      <Route path="/estimates/new">
        {(params) => <ProtectedRoute component={NewEstimate} {...params} />}
      </Route>
      <Route path="/estimates/:id">
        {(params) => <ProtectedRoute component={EstimateDetail} {...params} />}
      </Route>
      <Route path="/invoices">
        {(params) => <ProtectedRoute component={InvoicesList} {...params} />}
      </Route>
      <Route path="/invoices/:id">
        {(params) => <ProtectedRoute component={InvoiceDetail} {...params} />}
      </Route>
      <Route path="/customers">
        {(params) => <ProtectedRoute component={CustomersList} {...params} />}
      </Route>
      <Route path="/customers/:id">
        {(params) => <ProtectedRoute component={CustomerDetail} {...params} />}
      </Route>
      <Route path="/suppliers">
        {(params) => <ProtectedRoute component={SuppliersList} {...params} />}
      </Route>
      <Route path="/suppliers/:id">
        {(params) => <ProtectedRoute component={SupplierDetail} {...params} />}
      </Route>
      <Route path="/agents">
        {(params) => <ProtectedRoute component={AgentsList} {...params} />}
      </Route>
      <Route path="/agents/:id">
        {(params) => <ProtectedRoute component={AgentDetail} {...params} />}
      </Route>
      <Route path="/purchase-orders">
        {(params) => <ProtectedRoute component={PurchaseOrdersList} {...params} />}
      </Route>
      <Route path="/purchase-orders/new">
        {(params) => <ProtectedRoute component={NewPurchaseOrder} {...params} />}
      </Route>
      <Route path="/purchase-orders/:id">
        {(params) => <ProtectedRoute component={PurchaseOrderDetail} {...params} />}
      </Route>
      <Route path="/transfers">
        {(params) => <ProtectedRoute component={TransfersList} {...params} />}
      </Route>
      <Route path="/transfers/new">
        {(params) => <ProtectedRoute component={NewTransfer} {...params} />}
      </Route>
      <Route path="/transfers/:id">
        {(params) => <ProtectedRoute component={TransferDetail} {...params} />}
      </Route>
      <Route path="/coupons">
        {(params) => <ProtectedRoute component={CouponsList} {...params} />}
      </Route>
      <Route path="/reports/sales">
        {(params) => <ProtectedRoute component={SalesReport} {...params} />}
      </Route>
      <Route path="/reports/outstanding">
        {(params) => <ProtectedRoute component={OutstandingReport} {...params} />}
      </Route>
      <Route path="/reports/commission">
        {(params) => <ProtectedRoute component={CommissionReport} {...params} />}
      </Route>
      <Route path="/reports/gst">
        {(params) => <ProtectedRoute component={GstReport} {...params} />}
      </Route>
      <Route path="/reports/activity">
        {(params) => <ProtectedRoute component={ActivityReport} {...params} />}
      </Route>
      <Route path="/system/roles">
        {(params) => <ProtectedRoute component={RolesPage} {...params} />}
      </Route>
      <Route path="/profile">
        {(params) => <ProtectedRoute component={ProfilePage} {...params} />}
      </Route>
      <Route path="/users">
        {(params) => <ProtectedRoute component={UsersList} {...params} />}
      </Route>
      <Route path="/locations">
        {(params) => <ProtectedRoute component={LocationsList} {...params} />}
      </Route>
      <Route path="/settings">
        {(params) => <ProtectedRoute component={Settings} {...params} />}
      </Route>
      <Route path="/site-content">
        {(params) => <ProtectedRoute component={SiteContent} {...params} />}
      </Route>
      <Route path="/reviews">
        {(params) => <ProtectedRoute component={ReviewsModeration} {...params} />}
      </Route>
      <Route path="/help">
        {(params) => <ProtectedRoute component={HelpIndex} {...params} />}
      </Route>
      <Route path="/help/:topic">
        {(params) => <ProtectedRoute component={HelpTopic} {...params} />}
      </Route>
      <Route path="/verifier">
        {(params) => <ProtectedRoute component={Verifier} {...params} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
