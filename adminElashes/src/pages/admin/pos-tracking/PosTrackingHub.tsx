import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, CalendarClock, LogOut, Maximize2, Minimize2, ReceiptText, Store, Users } from "lucide-react";
import PosPage from "@/pages/admin/pos/Main";
import FollowUpPage from "@/pages/admin/follow-up/pages/FollowUpPage";
import QueuePage from "@/pages/admin/control-de-servicios/Queue";
import DailyAgendaPage from "@/pages/admin/calendar/DailyAgendaPage";
import { BranchService } from "@/core/services/branch/branch.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "@/core/utils/branch";
import useAuth from "@/core/hooks/useAuth";
import { logout as logoutAction } from "@/core/reducer/auth.reducer";
import type { AppDispatch } from "@/store";

type HubSection = "pos" | "tracking" | "queue" | "agenda";

function tabClass(active: boolean) {
  return `relative flex shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
    active
      ? "bg-white text-slate-900 shadow-sm"
      : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
  }`;
}

const HUB_TABS: { id: HubSection; label: string; icon: LucideIcon }[] = [
  { id: "pos", label: "Caja POS", icon: ReceiptText },
  { id: "queue", label: "Control de servicios", icon: Users },
  { id: "agenda", label: "Agenda del día", icon: CalendarClock },
];

export default function PosTrackingHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { hasRole, user } = useAuth();
  // Cajera: no vuelve al dashboard general — solo puede salir cerrando sesión.
  const isCajera = hasRole("Cajera");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [posCartCount, setPosCartCount] = useState(0);
  const [posPendingPayCount, setPosPendingPayCount] = useState(0);
  const [cartDrawerSignal, setCartDrawerSignal] = useState(0);

  // El header global (con el selector de sucursal) se oculta en pantalla
  // completa (ver .pos-hub-clean-fullscreen en styles.css) — sin esto acá,
  // no había forma de ver ni cambiar la sucursal activa desde esta pantalla.
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(() => getSelectedBranchId());

  // Cajera está atada a su propia sucursal — ni ve ni puede elegir otra acá,
  // para no terminar operando (o simplemente no viendo sus propios tickets)
  // en la sucursal equivocada por error.
  const ownBranchId = isCajera ? (user?.branch_id ?? null) : null;

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const handleChange = () => setSelectedBranchIdState(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  // Si la sucursal guardada no es la suya (quedó de una sesión anterior, o
  // alguien la cambió antes), la corrige sola apenas se sabe cuál es la suya.
  useEffect(() => {
    if (ownBranchId && selectedBranchId !== ownBranchId) {
      setSelectedBranchId(ownBranchId);
      setSelectedBranchIdState(ownBranchId);
    }
  }, [ownBranchId, selectedBranchId]);

  const handleBranchChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (ownBranchId) return;
    const value = Number(event.target.value);
    const next = Number.isFinite(value) && value > 0 ? value : null;
    setSelectedBranchIdState(next);
    setSelectedBranchId(next);
  };

  const resolveSection = (pathname: string): HubSection => {
    const base = "/admin/pos-tracking";
    if (!pathname.startsWith(base)) return "pos";
    const suffix = pathname.slice(base.length).replace(/^\/+/, "");
    const segment = suffix.split("/")[0];
    if (segment === "tracking") return "tracking";
    if (segment === "queue") return "queue";
    if (segment === "agenda") return "agenda";
    return "pos";
  };

  const [section, setSection] = useState<HubSection>(() => resolveSection(location.pathname));

  useEffect(() => {
    setSection(resolveSection(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const className = "pos-hub-clean-fullscreen";
    if (isFullscreen) document.body.classList.add(className);
    else document.body.classList.remove(className);
    return () => document.body.classList.remove(className);
  }, [isFullscreen]);

  const visible = HUB_TABS;

  const effectiveSection: HubSection = useMemo(() => {
    if (visible.some((t) => t.id === section)) return section;
    return "pos";
  }, [section, visible]);

  const go = (next: HubSection) => {
    setSection(next);
    navigate(next === "pos" ? "/admin/pos-tracking" : `/admin/pos-tracking/${next}`, { replace: true });
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    void document.documentElement.requestFullscreen();
  };

  const openCartDrawer = () => {
    setCartDrawerSignal((prev) => prev + 1);
  };

  const showCartFab = effectiveSection !== "pos" && posCartCount > 0;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-0 bg-[#f0f0f3] ${isFullscreen ? "h-screen overflow-hidden" : ""}`}
      style={{ minHeight: "100%", width: "100%" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-20 border-b border-slate-200/80 bg-[#f0f0f3] ${isFullscreen ? "px-3 py-2" : ""}`}>
        <div className="mx-auto flex w-full flex-row items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Operación: Caja &amp; Seguimiento</h1>
            <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white pl-2.5 pr-1.5">
              <Store className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <select
                value={selectedBranchId ?? ""}
                onChange={handleBranchChange}
                disabled={Boolean(ownBranchId)}
                className="max-w-40 truncate bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-500 sm:max-w-none"
                aria-label="Sucursal activa"
                title={ownBranchId ? "Tu cuenta está fija a esta sucursal" : "Sucursal activa"}
              >
                {ownBranchId ? (
                  <option value={ownBranchId}>{branches.find((b) => b.id === ownBranchId)?.name ?? user?.branch?.name ?? "Mi sucursal"}</option>
                ) : (
                  <>
                    <option value="">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="flex w-auto items-center gap-1.5">
            {isCajera ? (
              <button
                type="button"
                onClick={() => void dispatch(logoutAction())}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-rose-700 transition hover:bg-rose-100"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-xs font-semibold">Cerrar sesión</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-slate-600 transition hover:bg-slate-100"
                aria-label="Ir atras al dashboard"
                title="Ir atras al dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs font-semibold">Ir atras</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleFullscreen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <div className="flex w-auto gap-1 overflow-x-auto rounded-lg bg-slate-200/80 p-0.5">
              {visible.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  className={tabClass(effectiveSection === id)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  {id === "pos" && posCartCount > 0 && (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                      {posCartCount}
                    </span>
                  )}
                  {id === "pos" && posPendingPayCount > 0 && (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d83b01] px-1 text-[9px] font-bold text-white" title="Ventas pendientes de cobro">
                      {posPendingPayCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className={`relative min-h-0 flex-1 overflow-hidden ${isFullscreen ? "px-4 pb-4 pt-3" : "pt-4"}`}>
        <div className={`mx-auto flex h-full min-h-0 w-full max-w-none flex-col px-2 sm:px-4 ${isFullscreen ? "" : "min-h-[min(100%,calc(100vh-11rem))]"}`}>

          {/*
            PosPage is always mounted so cart state is preserved across tabs.
            When not on "pos" tab its container collapses to 0x0 (overflow:hidden),
            but fixed-position children (drawer backdrop + panel) escape and remain
            interactive, allowing the cart drawer to open from any hub tab.
          */}
          <div
            className={effectiveSection === "pos" ? "flex min-h-0 flex-1 flex-col" : ""}
            style={effectiveSection !== "pos" ? { height: 0, overflow: "hidden" } : undefined}
          >
            <PosPage
              embedded
              onCartCountChange={setPosCartCount}
              onPendingPaymentCountChange={setPosPendingPayCount}
              cartDrawerSignal={cartDrawerSignal}
              onRequestSwitchToPos={() => go("pos")}
            />
          </div>

          {effectiveSection === "tracking" ? <FollowUpPage embedded /> : null}
          {effectiveSection === "queue" ? <QueuePage embedded /> : null}
          {effectiveSection === "agenda" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <DailyAgendaPage embedded />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
