import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, X, type LucideIcon } from "lucide-react";

/**
 * Guía interactiva reutilizable: oscurece la pantalla y resalta el elemento REAL de cada paso
 * (con un aro animado) junto a una tarjeta que explica qué hace. Mismo estilo que la guía de la
 * Agenda. Un paso sin `selector` es una tarjeta centrada (bienvenida/cierre). Si el elemento de un
 * paso no existe en pantalla (p. ej. un botón al que el usuario no tiene permiso) el paso se omite.
 */
export type TourStep = {
  /** Selector CSS (normalmente `[data-tour="..."]`) del elemento a resaltar. null = tarjeta centrada. */
  selector: string | null;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Deja la pantalla en el estado correcto (cambiar de pestaña, abrir un panel) antes de buscar el elemento. */
  onEnter?: () => void;
};

type Props = {
  steps: TourStep[];
  storageKey: string;
  onClose: () => void;
};

/** Clave por usuario (no por navegador): varias personas suelen compartir el mismo equipo. */
export function tourStorageKey(tourId: string, userId: number | string | null | undefined): string {
  return `elashes_tour_${tourId}_seen_v1_${userId ?? "anon"}`;
}

/** Controla una guía: se abre sola la primera vez (por usuario) y se puede reabrir con `start`. */
export function useGuidedTour(tourId: string, userId: number | string | null | undefined, autoStart = true) {
  const key = tourStorageKey(tourId, userId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoStart || userId == null) return;
    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(key));
    } catch {
      seen = true; // sin localStorage no insistimos en cada visita
    }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 600); // espera a que la pantalla pinte
    return () => window.clearTimeout(timer);
  }, [key, autoStart, userId]);

  return { open, start: () => setOpen(true), close: () => setOpen(false), storageKey: key };
}

/** Botón "Guía" para reabrir la explicación de la pantalla. */
export function TourHelpButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ver la guía de esta pantalla"
      aria-label="Ver la guía de esta pantalla"
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 ${className}`}
    >
      <CircleHelp className="h-4 w-4" />
      Guía
    </button>
  );
}

const PAD = 8;
const CARD_W = 300;
const GAP = 14;
const CARD_H = 210;

type Rect = { top: number; left: number; width: number; height: number };
type Placement = "bottom" | "top" | "right" | "left" | "center";

const isVisible = (r: DOMRect) => r.width > 0 && r.height > 0;

export default function GuidedTour({ steps, storageKey, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // modo privado: no bloquea el cierre
    }
    onClose();
  };

  // Localiza el elemento del paso; si no existe se omite el paso en la dirección en que se navega.
  useEffect(() => {
    step.onEnter?.();
    if (!step.selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector as string);
      const box = el?.getBoundingClientRect();
      if (el && box && isVisible(box)) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
        // el scroll suave mueve el elemento: se vuelve a medir al terminar
        window.setTimeout(() => {
          if (cancelled) return;
          const again = el.getBoundingClientRect();
          if (isVisible(again)) setRect({ top: again.top, left: again.left, width: again.width, height: again.height });
        }, 380);
      } else if (attempts < 12) {
        attempts += 1;
        window.setTimeout(locate, 80);
      } else {
        setRect(null);
        const nextIndex = stepIndex + directionRef.current;
        if (nextIndex >= 0 && nextIndex < steps.length) setStepIndex(nextIndex);
        else if (directionRef.current === 1) finish();
      }
    };
    const t = window.setTimeout(locate, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    if (!step.selector) return;
    const handle = () => {
      const el = document.querySelector(step.selector as string);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (isVisible(r)) setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [step.selector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => {
    directionRef.current = 1;
    if (isLast) finish();
    else setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };
  const prev = () => {
    directionRef.current = -1;
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(CARD_W, vw - 24);

  let placement: Placement = "center";
  let cardTop = vh / 2 - CARD_H / 2;
  let cardLeft = vw / 2 - cardW / 2;

  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceRight = vw - (rect.left + rect.width);
    const spaceLeft = rect.left;
    if (spaceBelow >= CARD_H + GAP) {
      placement = "bottom";
      cardTop = rect.top + rect.height + GAP;
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    } else if (spaceAbove >= CARD_H + GAP) {
      placement = "top";
      cardTop = rect.top - GAP - CARD_H;
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    } else if (spaceRight >= cardW + GAP) {
      placement = "right";
      cardTop = rect.top + rect.height / 2 - CARD_H / 2;
      cardLeft = rect.left + rect.width + GAP;
    } else if (spaceLeft >= cardW + GAP) {
      placement = "left";
      cardTop = rect.top + rect.height / 2 - CARD_H / 2;
      cardLeft = rect.left - GAP - cardW;
    } else {
      placement = "bottom";
      cardTop = Math.min(rect.top + rect.height + GAP, vh - CARD_H - 12);
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    }
    cardLeft = Math.max(12, Math.min(cardLeft, vw - cardW - 12));
    cardTop = Math.max(12, Math.min(cardTop, vh - CARD_H - 12));
  }

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <style>{`
        @keyframes guidedTourPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.85), 0 0 24px 4px rgba(16,124,16,0.55), 0 0 0 9999px rgba(10,14,12,0.82); }
          50%      { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 34px 10px rgba(16,124,16,0.8), 0 0 0 9999px rgba(10,14,12,0.82); }
        }
        .guided-tour-ring { animation: guidedTourPulse 1.8s ease-in-out infinite; }
      `}</style>

      {rect ? (
        <div
          className="guided-tour-ring pointer-events-none fixed rounded-lg border-2 border-[#107c10] transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[#0a0e0c]/82" />
      )}

      {rect && placement !== "center" && (
        <div
          className="pointer-events-none fixed h-3 w-3 rotate-45 bg-white transition-all duration-300 ease-out"
          style={{
            top:
              placement === "bottom" ? cardTop - 6
              : placement === "top" ? cardTop + CARD_H - 6
              : Math.max(cardTop + 16, Math.min(rect.top + rect.height / 2 - 6, cardTop + CARD_H - 22)),
            left:
              placement === "right" ? cardLeft - 6
              : placement === "left" ? cardLeft + cardW - 6
              : Math.max(cardLeft + 16, Math.min(rect.left + rect.width / 2 - 6, cardLeft + cardW - 22)),
          }}
        />
      )}

      <div
        className="fixed flex flex-col overflow-hidden rounded-lg border border-[var(--ui-border-strong)] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="relative flex items-start gap-3 bg-[#094732] px-4 pb-4 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Icon className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-tight text-white">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Cerrar guía"
            className="-mr-1 -mt-1 rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-[var(--ui-text)]">{step.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-2.5">
          <span className="text-[11px] font-semibold text-[var(--ui-text-muted)]">
            {stepIndex + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={prev}
                className="flex items-center gap-1 rounded-lg border border-[var(--ui-border-strong)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-hover)]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1 rounded-lg bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#063324]"
            >
              {isLast ? "Entendido" : "Siguiente"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
