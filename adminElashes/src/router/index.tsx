import { useEffect, useRef, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux"; // Añadido useSelector

import variables from "@/core/config/variables";
import { getMe, logout as logoutAction } from "@/core/reducer/auth.reducer";
import type { AppDispatch, RootState } from "@/store"; // Ajusta RootState según tu store

import LoaderScreen from "@/components/common/LoaderScreen";
import { ToastContainer, toast } from "react-toastify";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ClientList from "@/pages/admin/clients/Main.tsx";
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import Effects from '@/pages/Effects';
import LashDesigns from '@/pages/LashDesigns';
import EyeTypes from '@/pages/EyeTypes';
import Designs from '@/pages/Designs';
import Volumen from '@/pages/admin/Volumen';
import ProductsPage from '@/pages/admin/products/Main';
import SalonsPage from '@/pages/admin/salons/Main';
import ServicesPage from '@/pages/admin/services/Main';
import ServiceQueuePage from '@/pages/admin/control-de-servicios/Queue';
import TurnScreen from '@/pages/admin/control-de-servicios/TurnScreen';
import TicketsPage from '@/pages/admin/tickets/Main';
import CalendarPage from '@/pages/admin/calendar/Main';
import PosPage from '@/pages/admin/pos/Main';
import FollowUpPage from '@/pages/admin/follow-up/pages/FollowUpPage';
import PosTrackingHub from '@/pages/admin/pos-tracking/PosTrackingHub';
import CompletedTicketsHistory from "@/pages/admin/pos-tracking/CompletedTicketsHistory";
import ProfessionalServiceHistory from "@/pages/admin/professionals/History";
import NotFoundPage from "@/pages/NotFoundPage";
import PrivateRoute from "./PrivateRoute";
import GuestRoute from "./GuestRoute";
import Question from "@/pages/admin/Questionnaire";
import Register from "@/pages/Register";

export default function AppRouter() {
  const dispatch = useDispatch<AppDispatch>();
  const [checkingAuth, setCheckingAuth] = useState(true);
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
          <Route path="register" element={<Register/>} />
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
            <Route path="admin/products" element={<ProductsPage />} />
            <Route path="admin/salons" element={<SalonsPage />} />
            <Route path="admin/services" element={<ServicesPage />} />
            <Route path="admin/services/categories" element={<ServicesPage />} />
            <Route path="admin/services/queue" element={<ServiceQueuePage />} />
            <Route path="admin/turns" element={<TurnScreen />} />
            <Route path="admin/tickets" element={<TicketsPage />} />
            <Route path="admin/tickets/finalizados" element={<CompletedTicketsHistory />} />
            <Route path="admin/professionals/history" element={<ProfessionalServiceHistory />} />
            <Route path="admin/calendar" element={<CalendarPage />} />
            <Route path="admin/calendar/citas" element={<CalendarPage />} />
            <Route path="admin/calendar/agenda" element={<CalendarPage />} />
            <Route path="admin/pos" element={<PosPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}