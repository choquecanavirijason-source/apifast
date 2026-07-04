import React, { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Bell, X } from "lucide-react";
import { toast } from "react-toastify";
import MarketplaceSidebar from "./MarketplaceSidebar";
import ModeSwitch from "@/components/layout/ModeSwitch";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { fetchAdminOrders } from "@/core/services/marketplace/marketplace.service";

const POLL_INTERVAL_MS = 30_000;

export default function MarketplaceLayout() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);
  const lastPendingRef = useRef<number | null>(null);
  const [notifBanner, setNotifBanner] = useState(
    () => "Notification" in window && Notification.permission === "default"
  );
  const user = useSelector((s: RootState) => s.auth.user as { name?: string; email?: string } | null);

  const requestNotifPermission = () => {
    void Notification.requestPermission().then((p) => {
      setNotifBanner(false);
      if (p === "granted") toast.success("¡Notificaciones activadas! Recibirás alertas de nuevos pedidos.");
      else toast.info("Notificaciones denegadas. Puedes activarlas desde la configuración del navegador.");
    });
  };

  useEffect(() => {
    const checkOrders = async () => {
      try {
        const res = await fetchAdminOrders({ status: "pending", limit: 1 });
        const count = res.total;
        setPendingOrders(count);
        if (lastPendingRef.current !== null && count > lastPendingRef.current) {
          const newCount = count - lastPendingRef.current;
          toast.info(`🛍️ ${newCount} nuevo${newCount !== 1 ? "s" : ""} pedido${newCount !== 1 ? "s" : ""} pendiente${newCount !== 1 ? "s" : ""}`, {
            toastId: "new-orders",
            position: "top-right",
            autoClose: 6000,
          });
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Nuevo pedido en Marketplace", {
              body: `${newCount} nuevo${newCount !== 1 ? "s" : ""} pedido${newCount !== 1 ? "s" : ""} esperando confirmación`,
              icon: "/favicon.ico",
            });
          }
        }
        lastPendingRef.current = count;
      } catch { /* silencioso */ }
    };

    void checkOrders();
    const id = window.setInterval(() => void checkOrders(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <MarketplaceSidebar collapsed={collapsed} pendingOrders={pendingOrders} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header marketplace */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-blue-900/50 bg-[#0f1a2e] shadow-lg z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-2 rounded-lg text-blue-300 hover:bg-white/10 transition"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-white/80 hidden sm:block">
              Gestión Marketplace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ModeSwitch />

            {/* User avatar */}
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-blue-800/60">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-800">
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </div>
                <span className="text-xs text-blue-200 hidden md:block truncate max-w-[100px]">
                  {user.name ?? user.email}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Banner permiso notificaciones */}
        {notifBanner && (
          <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 shrink-0">
            <Bell className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1">
              Activa las notificaciones del navegador para recibir alertas de nuevos pedidos en tiempo real.
            </span>
            <button
              onClick={requestNotifPermission}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 transition shrink-0"
            >
              Activar
            </button>
            <button onClick={() => setNotifBanner(false)} className="text-amber-400 hover:text-amber-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
