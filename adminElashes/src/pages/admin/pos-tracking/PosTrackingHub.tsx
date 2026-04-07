import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ClipboardList, Maximize2, Minimize2, ReceiptText, Users } from "lucide-react";
import PosPage from "@/pages/admin/pos/Main";
import FollowUpPage from "@/pages/admin/follow-up/pages/FollowUpPage";
import QueuePage from "@/pages/admin/control-de-servicios/Queue";
import CalendarPage from "@/pages/admin/calendar/Main";
type HubSection = "pos" | "tracking" | "queue" | "calendar";

function tabClass(active: boolean) {
  return `flex shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
    active
      ? "bg-white text-slate-900 shadow-sm"
      : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
  }`;
}

const HUB_TABS: { id: HubSection; label: string; icon: LucideIcon }[] = [
  { id: "pos", label: "Caja POS", icon: ReceiptText },
  { id: "tracking", label: "Seguimiento", icon: ClipboardList },
  { id: "queue", label: "Control de servicios", icon: Users },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
];

export default function PosTrackingHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const resolveSection = (pathname: string): HubSection => {
    const base = "/admin/pos-tracking";
    if (!pathname.startsWith(base)) return "pos";
    const suffix = pathname.slice(base.length).replace(/^\/+/, "");
    const segment = suffix.split("/")[0];
    if (segment === "tracking") return "tracking";
    if (segment === "queue") return "queue";
    if (segment === "calendar") return "calendar";
    return "pos";
  };

  const [section, setSection] = useState<HubSection>(() => resolveSection(location.pathname));

  useEffect(() => {
    setSection(resolveSection(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const className = "pos-hub-clean-fullscreen";
    if (isFullscreen) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }

    return () => {
      document.body.classList.remove(className);
    };
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
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    // Fullscreen on the entire document keeps global overlays visible.
    void document.documentElement.requestFullscreen();
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-0 bg-[#f0f0f3] ${isFullscreen ? "h-screen overflow-hidden" : ""}`}
      style={{ minHeight: "100%", width: "100%", maxWidth: "90vw", marginInline: "auto" }}
    >
      <div className={`sticky top-0 z-20 border-b border-slate-200/80 bg-[#f0f0f3] ${isFullscreen ? "px-3 py-2" : ""}`}>
        <div className="mx-auto flex w-full max-w-[90vw] flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Operación: Caja &amp; Seguimiento</h1>
            <p className="text-[11px] text-slate-500">Ventas en punto de seguimiento y registro técnico en un solo lugar</p>
          </div>
          <div className="flex w-auto items-center gap-1.5">
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
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-hidden ${isFullscreen ? "px-4 pb-4 pt-3" : "pt-4"}`}>
        <div className={`mx-auto flex h-full min-h-0 w-full max-w-[90vw] flex-col ${isFullscreen ? "" : "min-h-[min(100%,calc(100vh-11rem))]"}`}>
          {effectiveSection === "pos" ? <PosPage embedded /> : null}
          {effectiveSection === "tracking" ? <FollowUpPage embedded /> : null}
          {effectiveSection === "queue" ? <QueuePage /> : null}
          {effectiveSection === "calendar" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <CalendarPage embedded />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
