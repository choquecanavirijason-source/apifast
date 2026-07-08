import { useEffect, useRef, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import variables from "@/core/config/variables";
import { getMe, logout as logoutAction } from "@/core/reducer/auth.reducer";
import { commitMode } from "@/core/reducer/modeSlice";
import type { AppDispatch, RootState } from "@/store";

import LoaderScreen from "@/components/common/LoaderScreen";
import { ToastContainer, toast } from "react-toastify";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import Layout from '@/components/layout/Layout';
import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/admin/dashboard/Dashboard';
import ClientList from "@/pages/admin/clients/Main.tsx";
import Users from '@/pages/admin/users/main';
import Settings from '@/pages/admin/settings/Settings';
import Effects from '@/pages/admin/catalog/Effects';
import LashDesigns from '@/pages/admin/catalog/LashDesigns';
import EyeTypes from '@/pages/admin/catalog/EyeTypes';
import Designs from '@/pages/admin/catalog/Designs';
import Volumen from '@/pages/admin/Volumen';
import ProductsPage from '@/pages/admin/products/Main';
import SalonsPage from '@/pages/admin/salons/Main';
import AdminAiPage from '@/pages/admin/ai/Main';
import ServicesPage from '@/pages/admin/services/Main';
import ServiceQueuePage from '@/pages/admin/control-de-servicios/Queue';
import TurnScreen from '@/pages/admin/control-de-servicios/TurnScreen';
import TicketsPage from '@/pages/admin/tickets/Main';
import CalendarPage from '@/pages/admin/calendar/Main';
import DailyAgendaPage from "@/pages/admin/calendar/DailyAgendaPage";
import PosPage from '@/pages/admin/pos/Main';
import FollowUpPage from '@/pages/admin/follow-up/pages/FollowUpPage';
import PosTrackingHub from '@/pages/admin/pos-tracking/PosTrackingHub';
import CierreDeCajaPage from '@/pages/admin/cierre-de-caja/CierreDeCaja';
import CompletedTicketsHistory from "@/pages/admin/pos-tracking/CompletedTicketsHistory";
import ProfessionalServiceHistory from "@/pages/admin/professionals/History";
import TicketsHistoryPage from "@/pages/admin/professionals/TicketsHistory";
import NotFoundPage from "@/pages/NotFoundPage";
import PrivateRoute from "./PrivateRoute";
import GuestRoute from "./GuestRoute";
import Question from "@/pages/admin/Questionnaire";
import ProfilePage from "@/pages/admin/profile/ProfilePage";
import MarketplaceLayout from "@/modes/marketplace/layout/MarketplaceLayout";
import MarketplaceDashboard from "@/modes/marketplace/pages/dashboard/Dashboard";
import MarketplaceProductsPage from "@/modes/marketplace/pages/products/ProductsPage";
import MarketplaceCategoriesPage from "@/modes/marketplace/pages/categories/CategoriesPage";
import MarketplaceCatalogPage from "@/modes/marketplace/pages/catalog/CatalogPage";
import ImportInventoryPage from "@/modes/marketplace/pages/import-inventory/ImportInventoryPage";
import MarketplaceOrdersPage from "@/modes/marketplace/pages/orders/OrdersPage";
import MarketplaceSettingsPage from "@/modes/marketplace/pages/settings/SettingsPage";
import InventoryOverviewPage from "@/modes/marketplace/pages/inventory/InventoryOverviewPage";
import AdsPage from "@/modes/marketplace/pages/ads/AdsPage";
import ReelsPage from "@/modes/marketplace/pages/reels/ReelsPage";

export default function AppRouter() {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Sincroniza el modo con la URL para que ModeSwitch siempre refleje la ruta activa
  useEffect(() => {
    const next = location.pathname.startsWith("/marketplace") ? "marketplace" : "salon";
    dispatch(commitMode(next));
  }, [location.pathname, dispatch]);
  const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000;
  const IDLE_WARNING_MS = 2 * 60 * 60 * 1000;
  const LAST_ACTIVITY_KEY = "last_activity_at";
  const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
  const warnedRef = useRef(false);
  
  // 1. ESCUCHAR EL ESTADO GLOBAL
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const token = localStorage.getItem(variables.session.tokenName);
    const expiresAt = localStorage.getItem(variables.session.sessionExpiresAt);
    if (token && expiresAt) {
      const expiresMs = Date.parse(expiresAt);
      if (Number.isFinite(expiresMs) && Date.now() >= expiresMs) {
        void dispatch(logoutAction()).finally(() => setCheckingAuth(false));
        return;
      }
    }
    
    // 2. CONDICIÓN ANTI-BUCLE: Solo pedir si hay token Y NO hay usuario cargado
    if (token && !user) {
      dispatch(getMe()).finally(() => setCheckingAuth(false));
    } else {
      setCheckingAuth(false);
    }
    // Si quitamos el token (Logout), este efecto se dispara y setCheckingAuth termina el proceso
  }, [dispatch, user]); 

  useEffect(() => {
    const token = localStorage.getItem(variables.session.tokenName);
    if (!token) {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    const updateActivity = () => {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      warnedRef.current = false;
    };

    updateActivity();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, updateActivity);
    });

    const interval = window.setInterval(() => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (!lastActivity) return;
      const idleMs = Date.now() - lastActivity;
      if (idleMs >= IDLE_WARNING_MS && idleMs < IDLE_TIMEOUT_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning("Tu sesión se cerrará por inactividad en unos minutos (antes de las 24 h).");
      }
      if (idleMs > IDLE_TIMEOUT_MS) {
        void dispatch(logoutAction());
      }
    }, 60000);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, updateActivity);
      });
    };
  }, [dispatch, user]);

  if (checkingAuth) {
    return <LoaderScreen />;
  }

  return (
    <>
      <ToastContainer
        position="top-right"
        newestOnTop
        autoClose={3500}
        closeOnClick
        pauseOnHover
        draggable
        style={{ zIndex: 2147483647 }}
        toastStyle={{ zIndex: 2147483647 }}
      />
      <ScrollToTop />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="login" element={<Login />} />
        </Route>

        <Route element={<PrivateRoute />}>
           <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="effects" element={<Effects />} />
            <Route path="lash-designs" element={<LashDesigns />} />
            <Route path="eye-types" element={<EyeTypes />} />
            <Route path="designs" element={<Designs />} />
            <Route path="volumen" element={<Volumen />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
            <Route path="questionnaire" element={<Question/>}/>
            <Route path="lash-tracking" element={<FollowUpPage />} />
            <Route path="admin/pos-tracking" element={<PosTrackingHub />} />
            <Route path="admin/pos-tracking/tracking" element={<PosTrackingHub />} />
            <Route path="admin/pos-tracking/queue" element={<PosTrackingHub />} />
            <Route path="admin/pos-tracking/calendar" element={<PosTrackingHub />} />
            <Route path="admin/pos-tracking/agenda" element={<PosTrackingHub />} />
            <Route path="admin/products" element={<ProductsPage />} />
            <Route path="admin/salons" element={<SalonsPage />} />
            <Route path="admin/ai" element={<AdminAiPage />} />
            <Route path="admin/services" element={<ServicesPage />} />
            <Route path="admin/services/categories" element={<ServicesPage />} />
            <Route path="admin/services/queue" element={<ServiceQueuePage />} />
            <Route path="admin/turns" element={<TurnScreen />} />
            <Route path="admin/tickets" element={<TicketsPage />} />
            <Route path="admin/tickets/finalizados" element={<CompletedTicketsHistory />} />
            <Route path="admin/professionals/history" element={<ProfessionalServiceHistory />} />
            <Route path="admin/professionals/tickets" element={<TicketsHistoryPage />} />
            <Route path="admin/calendar" element={<CalendarPage />} />
            <Route path="admin/calendar/citas" element={<CalendarPage />} />
            <Route path="admin/calendar/agenda" element={<DailyAgendaPage />} />
            <Route path="admin/pos" element={<PosPage section="sale" />} />
            <Route path="admin/pos/history" element={<PosPage section="history" />} />
            <Route path="admin/cierre-de-caja" element={<CierreDeCajaPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* ── Modo Marketplace ─────────────────────────────────── */}
        <Route element={<PrivateRoute />}>
          <Route element={<MarketplaceLayout />}>
            <Route path="marketplace" element={<MarketplaceDashboard />} />
            <Route path="marketplace/products" element={<MarketplaceProductsPage />} />
            <Route path="marketplace/categories" element={<MarketplaceCategoriesPage />} />
            <Route path="marketplace/ads" element={<AdsPage />} />
            <Route path="marketplace/reels" element={<ReelsPage />} />
            <Route path="marketplace/catalog" element={<MarketplaceCatalogPage />} />
            <Route path="marketplace/orders" element={<MarketplaceOrdersPage />} />
            <Route path="marketplace/import-inventory" element={<ImportInventoryPage />} />
            <Route path="marketplace/inventory" element={<InventoryOverviewPage />} />
            <Route path="marketplace/settings" element={<MarketplaceSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}