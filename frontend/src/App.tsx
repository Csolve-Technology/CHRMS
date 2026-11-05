import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { landingPath, AuthProvider, useAuth } from "./contexts/AuthContext";
import { I18nProvider } from "./contexts/I18nContext";
import Layout from "./components/layout/Layout";

import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PropertiesPage from "./pages/PropertiesPage";
import PropertyDetailPage from "./pages/PropertyDetailPage";
import TenantsPage from "./pages/TenantsPage";
import TenantDetailPage from "./pages/TenantDetailPage";
import RentalsPage from "./pages/RentalsPage";
import RentalDetailPage from "./pages/RentalDetailPage";
import SalesPage from "./pages/SalesPage";
import SaleDetailPage from "./pages/SaleDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" />
      </div>
    );
  }

  return !isAuthenticated ? (
    <>{children}</>
  ) : (
    <Navigate to={landingPath(user)} replace />
  );
}

function PermissionRoute({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  return permissions.some(hasPermission) ? (
    <>{children}</>
  ) : (
    <div className="p-8" role="alert">
      You have not been granted access to this page. Contact your administrator.
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="no-access"
          element={
            <div className="p-8">
              Your account has no CHRMS permissions yet. Contact your
              administrator.
            </div>
          }
        />
        <Route
          path="dashboard"
          element={
            <PermissionRoute permissions={["dashboard.read"]}>
              <Dashboard />
            </PermissionRoute>
          }
        />
        <Route
          path="properties"
          element={
            <PermissionRoute permissions={["properties.read"]}>
              <PropertiesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="properties/:id"
          element={
            <PermissionRoute permissions={["properties.read"]}>
              <PropertyDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="tenants"
          element={
            <PermissionRoute permissions={["tenants.read"]}>
              <TenantsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="tenants/:id"
          element={
            <PermissionRoute permissions={["tenants.read"]}>
              <TenantDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="rentals"
          element={
            <PermissionRoute permissions={["rentals.read"]}>
              <RentalsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="rentals/:id"
          element={
            <PermissionRoute permissions={["rentals.read"]}>
              <RentalDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales"
          element={
            <PermissionRoute permissions={["sales.read"]}>
              <SalesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/:id"
          element={
            <PermissionRoute permissions={["sales.read"]}>
              <SaleDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="payments"
          element={
            <PermissionRoute
              permissions={["rental_payments.read", "sale_payments.read"]}
            >
              <PaymentsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionRoute permissions={["reports.read"]}>
              <ReportsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <PermissionRoute permissions={["users.read", "roles.read"]}>
              <UsersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <PermissionRoute permissions={["settings.read"]}>
              <SettingsPage />
            </PermissionRoute>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="chrms-theme"
    >
      <TooltipProvider>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
          <Toaster />
        </I18nProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
