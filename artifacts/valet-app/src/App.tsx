import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { OfflineBanner } from "@/components/offline-banner";
import { useOfflineSync } from "@/hooks/useOfflineSync";

import Login from "@/pages/login";
import Home from "@/pages/home";
import Work from "@/pages/work";
import NewTicket from "@/pages/new-ticket";
import Search from "@/pages/search";
import HistoryPage from "@/pages/history";
import OwnerPanel from "@/pages/owner";
import AdminPanel from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";

const TEN_MINUTES = 10 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: TEN_MINUTES,
      gcTime: 15 * 60 * 1000,
      retry: 1,
    },
  },
});

function SyncLayer() {
  useOfflineSync();
  return null;
}

function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles?: string[] }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!session) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/work">
        {() => <ProtectedRoute component={Work} allowedRoles={["admin", "driver", "owner"]} />}
      </Route>
      <Route path="/new-ticket">
        {() => <ProtectedRoute component={NewTicket} allowedRoles={["admin", "driver", "owner"]} />}
      </Route>
      <Route path="/search">
        {() => <ProtectedRoute component={Search} allowedRoles={["admin", "driver", "owner"]} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={HistoryPage} allowedRoles={["owner"]} />}
      </Route>
      <Route path="/owner">
        {() => <ProtectedRoute component={OwnerPanel} allowedRoles={["owner"]} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPanel} allowedRoles={["admin"]} />}
      </Route>
      <Route path="/pricing" component={PricingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <OfflineBanner />
            <SyncLayer />
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
        <Sonner richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
