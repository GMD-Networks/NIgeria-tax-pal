import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { useDeadlineReminders } from "@/hooks/useDeadlineReminders";
import Index from "./pages/Index";
import Learn from "./pages/Learn";
import Calculator from "./pages/Calculator";
import TaxTools from "./pages/TaxTools";
import Invoice from "./pages/Invoice";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Subscription from "./pages/Subscription";
import ReceiptScanner from "./pages/ReceiptScanner";
import TaxCalendar from "./pages/TaxCalendar";
import ComplianceChecklist from "./pages/ComplianceChecklist";
import TaxSavings from "./pages/TaxSavings";
import BusinessAssessment from "./pages/BusinessAssessment";
import TINLookup from "./pages/TINLookup";
import Payroll from "./pages/Payroll";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import ContentManager from "./pages/admin/ContentManager";
import RatesManager from "./pages/admin/RatesManager";
import ChatsManager from "./pages/admin/ChatsManager";
import UsersManager from "./pages/admin/UsersManager";
import Settings from "./pages/admin/Settings";
import "./i18n";

const queryClient = new QueryClient();

const PushNotificationInitializer = () => {
  usePushNotifications();
  return null;
};

const DeepLinkHandler = () => {
  useDeepLinks();
  return null;
};

const DeadlineReminderHandler = () => {
  useDeadlineReminders();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <PushNotificationInitializer />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DeepLinkHandler />
          <DeadlineReminderHandler />
          <Routes>
            {/* All public routes - completely free access */}
            <Route path="/" element={<Index />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/tax-tools" element={<TaxTools />} />
            <Route path="/invoice" element={<Invoice />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/document-scanner" element={<ReceiptScanner />} />
            <Route path="/receipt-scanner" element={<ReceiptScanner />} />
            <Route path="/tax-calendar" element={<TaxCalendar />} />
            <Route path="/compliance-checklist" element={<ComplianceChecklist />} />
            <Route path="/tax-savings" element={<TaxSavings />} />
            <Route path="/business-assessment" element={<BusinessAssessment />} />
            <Route path="/tin-lookup" element={<TINLookup />} />
            <Route path="/payroll" element={<Payroll />} />
            
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
            
            {/* Admin routes only */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="content" element={<ContentManager />} />
              <Route path="rates" element={<RatesManager />} />
              <Route path="chats" element={<ChatsManager />} />
              <Route path="users" element={<UsersManager />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
