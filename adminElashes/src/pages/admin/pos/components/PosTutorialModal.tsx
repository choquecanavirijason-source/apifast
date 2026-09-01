import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, X, Search, ShoppingCart, UserPlus, UserCog,
  Wallet, LayoutList, Sparkles, PlayCircle, type LucideIcon,
} from "lucide-react";

/** Por usuario (no por navegador) — varias operarias suelen compartir la
 * misma laptop, así que la key incluye el id de quien inició sesión. */
export function getPosTutorialStorageKey(userId: number | string | null | undefined): string {
  return `elashes_pos_tutorial_seen_v1_${userId ?? "anon"}`;
}

type DrawerStep = "servicios" | "cliente" | "pago" | null;

type TourStep = {
  /** Selector CSS del elemento real a resaltar — null = tarjeta centrada sin spotlight (bienvenida). */
  selector: string | null;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Deja el POS en el estado correcto (carrito abierto, pestaña interna, etc.) antes de buscar el elemento. */
  onEnter?: () => void;
};

type Props = {
  onClose: () => void;
  setIsCartOpen: (open: boolean) => void;
  setDrawerForceStep: (step: DrawerStep) => void;
  storageKey: string;
};

const PAD = 8;
const CARD_W = 300;
const GAP = 14;

type Rect = { top: number; left: number; width: number; height: number };
type Placement = "bottom" | "top" | "right" | "left" | "center";

export default function PosTutorialModal({ onClose, setIsCartOpen, setDrawerForceStep, storageKey }: Props) {
  const stepsRef = useRef<TourStep[]>([
    {
      selector: null,
      icon: Sparkles,
      title: "Bienvenida al Punto de Venta",
      description:
        "Esta es la Caja registradora — desde acá registrás cada venta de servicios y productos. Te mostramos rápido para qué sirve cada parte, señalando cada botón en pantalla.",
    },
    {
      selector: '[data-tour="pos-search"]',
      icon: Search,
      title: "Buscar y agregar",
      description: "Escribí acá para buscar un servicio o producto y agregarlo al carrito de la venta actual.",
      onEnter: () => { setIsCartOpen(false); setDrawerForceStep(null); },
    },
    {
      selector: '[data-tour="pos-cart-btn"]',
      icon: ShoppingCart,
      title: "Carrito de la venta",
      description: "Acá se abre el panel con todo lo agregado: servicios, cliente y método de pago. El número muestra cuántos ítems lleva la venta.",
      onEnter: () => { setIsCartOpen(false); setDrawerForceStep(null); },
    },
    {
      selector: '[data-tour="pos-drawer-tabs"]',
      icon: ShoppingCart,
      title: "Dentro del carrito",
      description: "El panel se organiza en 3 pasos: Servicios (lo que se lleva), Cliente y Pago. \"Junto\" arma un solo ticket; \"Separados\" crea uno por servicio.",
      onEnter: () => { setIsCartOpen(true); setDrawerForceStep("servicios"); },
    },
    {
      selector: '[data-tour="pos-drawer-client-search"]',
      icon: UserPlus,
      title: "Datos del cliente",
      description: "Buscá una clienta existente o registrá una nueva sin salir del POS. Si no elegís ninguna, la venta queda a nombre de \"Cliente Mostrador\".",
      onEnter: () => { setIsCartOpen(true); setDrawerForceStep("cliente"); },
    },
    {
      selector: '[data-tour="pos-drawer-operaria"]',
      icon: UserCog,
      title: "Operaria",
      description: "Asigná qué operaria atiende esta venta. Si está ocupada con otro servicio, el sistema te avisa antes de dejarte continuar.",
      onEnter: () => { setIsCartOpen(true); setDrawerForceStep("pago"); },
    },
    {
      selector: '[data-tour="pos-drawer-payment"]',
      icon: Wallet,
      title: "Método de pago",
      description: "Elegí entre Efectivo, Tarjeta, Transferencia, QR o \"Mixto\" para combinar. Con Efectivo es obligatorio cargar el monto recibido antes de poder cerrar la venta.",
      onEnter: () => { setIsCartOpen(true); setDrawerForceStep("pago"); },
    },
    {
      selector: '[data-tour="pos-drawer-checkout-buttons"]',
      icon: PlayCircle,
      title: "Crear turno o pasar a servicio",
      description: "\"Crear turno\" cobra y deja el ticket en la cola de espera (útil si la operaria está ocupada). \"Pasar a servicio\" cobra y arranca la atención ya mismo — necesita una operaria libre asignada.",
      onEnter: () => { setIsCartOpen(true); setDrawerForceStep("pago"); },
    },
    {
      selector: '[data-tour="pos-tabs"]',
      icon: LayoutList,
      title: "Pestañas de arriba",
      description: "\"Nueva venta\" siempre te deja lista para la próxima venta. \"Historial\" muestra todas las ventas registradas. \"Último ticket\" reabre el comprobante recién cobrado.",
      onEnter: () => { setIsCartOpen(false); setDrawerForceStep(null); },
    },
  ]);
  const steps = stepsRef.current;

  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const cleanupPos = () => {
    setIsCartOpen(false);
    setDrawerForceStep(null);
  };

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // localStorage puede fallar en modo privado — no bloquea el cierre.
    }
    cleanupPos();
    onClose();
  };

  // Ubica el elemento real de este paso (con reintentos cortos: recién se
  // abre el carrito/cambia de pestaña interna, y el DOM tarda un tick).
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
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (attempts < 12) {
        attempts += 1;
        window.setTimeout(locate, 80);
      } else {
        setRect(null); // no se encontró — cae a tarjeta centrada
      }
    };
    const t = window.setTimeout(locate, 40);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Mantiene el resaltado pegado al elemento si la ventana cambia de tamaño
  // o hay scroll dentro del panel.
  useEffect(() => {
    if (!step.selector) return;
    const handle = () => {
      const el = document.querySelector(step.selector as string);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [step.selector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => cleanupPos(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => (isLast ? finish() : setStepIndex((i) => Math.min(steps.length - 1, i + 1)));
  const prev = () => setStepIndex((i) => Math.max(0, i - 1));

  // ── Geometría de la tarjeta + flecha respecto al elemento resaltado ──────
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const CARD_H_ESTIMATE = 210;

  let placement: Placement = "center";
  let cardTop = vh / 2 - CARD_H_ESTIMATE / 2;
  let cardLeft = vw / 2 - CARD_W / 2;

  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceRight = vw - (rect.left + rect.width);
    const spaceLeft = rect.left;

    if (spaceBelow >= CARD_H_ESTIMATE + GAP) {
      placement = "bottom";
      cardTop = rect.top + rect.height + GAP;
      cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
    } else if (spaceAbove >= CARD_H_ESTIMATE + GAP) {
      placement = "top";
      cardTop = rect.top - GAP - CARD_H_ESTIMATE;
      cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
    } else if (spaceRight >= CARD_W + GAP) {
      placement = "right";
      cardTop = rect.top + rect.height / 2 - CARD_H_ESTIMATE / 2;
      cardLeft = rect.left + rect.width + GAP;
    } else if (spaceLeft >= CARD_W + GAP) {
      placement = "left";
      cardTop = rect.top + rect.height / 2 - CARD_H_ESTIMATE / 2;
      cardLeft = rect.left - GAP - CARD_W;
    } else {
      placement = "bottom";
      cardTop = Math.min(rect.top + rect.height + GAP, vh - CARD_H_ESTIMATE - 12);
      cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
    }
    cardLeft = Math.max(12, Math.min(cardLeft, vw - CARD_W - 12));
    cardTop = Math.max(12, Math.min(cardTop, vh - 12));
  }

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <style>{`
        @keyframes posTourPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.85), 0 0 24px 4px rgba(16,124,16,0.55), 0 0 0 9999px rgba(10,14,12,0.82); }
          50%      { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 34px 10px rgba(16,124,16,0.8), 0 0 0 9999px rgba(10,14,12,0.82); }
        }
        .pos-tour-ring { animation: posTourPulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Fondo bien oscurecido con el "agujero" recortado sobre el elemento
          activo — cuanto más oscuro el resto, más resalta lo que se explica. */}
      {rect ? (
        <div
          className="pos-tour-ring pointer-events-none fixed rounded-lg border-2 border-[#107c10] transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 3px rgba(255,255,255,0.85), 0 0 24px 4px rgba(16,124,16,0.55), 0 0 0 9999px rgba(10,14,12,0.82)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[#0a0e0c]/82" />
      )}

      {/* Flecha apuntando desde la tarjeta hacia el elemento resaltado */}
      {rect && placement !== "center" && (
        <div
          className="pointer-events-none fixed h-3 w-3 rotate-45 bg-white transition-all duration-300 ease-out"
          style={{
            top:
              placement === "bottom" ? cardTop - 6
              : placement === "top" ? cardTop + CARD_H_ESTIMATE - 6
              : Math.max(cardTop + 16, Math.min(rect.top + rect.height / 2 - 6, cardTop + CARD_H_ESTIMATE - 22)),
            left:
              placement === "right" ? cardLeft - 6
              : placement === "left" ? cardLeft + CARD_W - 6
              : Math.max(cardLeft + 16, Math.min(rect.left + rect.width / 2 - 6, cardLeft + CARD_W - 22)),
            boxShadow: placement === "bottom" || placement === "right"
              ? "-2px -2px 2px rgba(0,0,0,0.04)"
              : "2px 2px 2px rgba(0,0,0,0.04)",
          }}
        />
      )}

      {/* Tarjeta */}
      <div
        className="fixed flex flex-col overflow-hidden rounded-sm border border-[#d2d0ce] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div className="flex items-start gap-3 bg-[#094732] px-4 pb-4 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Icon className="h-4.5 w-4.5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-tight text-white">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Cerrar guía"
            className="-mr-1 -mt-1 rounded-sm p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-[#323130]">{step.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#edebe9] bg-[#faf9f8] px-4 py-2.5">
          <span className="text-[11px] font-semibold text-[#a19f9d]">{stepIndex + 1} / {steps.length}</span>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={prev}
                className="flex items-center gap-1 rounded-sm border border-[#8a8886] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#323130] transition hover:bg-[#f3f2f1]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1 rounded-sm bg-[#094732] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#063324]"
            >
              {isLast ? "Empezar a vender" : "Siguiente"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
