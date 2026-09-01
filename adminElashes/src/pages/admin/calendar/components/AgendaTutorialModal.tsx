import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, X, CalendarClock, CalendarDays, Plus, MousePointerClick,
  GripVertical, Wallet, Printer, ChevronDown, Search, User, UserCog, CheckCircle2, type LucideIcon,
} from "lucide-react";

/** Por usuario (no por navegador) — varias operarias suelen compartir la
 * misma laptop, así que la key incluye el id de quien inició sesión. */
export function getAgendaTutorialStorageKey(userId: number | string | null | undefined): string {
  return `elashes_agenda_tutorial_seen_v1_${userId ?? "anon"}`;
}

type Illustration = "overview" | "drag" | "venta" | null;

type TourStep = {
  /** Selector CSS del elemento real a resaltar — null si el paso usa una tarjeta ilustrativa (o la bienvenida). */
  selector: string | null;
  /** Tarjeta de reserva simulada — para explicar partes que no siempre existen (día sin reservas). */
  illustration: Illustration;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Deja la pantalla en el estado correcto (drawer de "Nueva reserva" abierto/cerrado) antes de buscar el elemento. */
  onEnter?: () => void;
};

type Props = {
  onClose: () => void;
  storageKey: string;
  /** Abre el panel de "Nueva reserva" — se usa para resaltar sus campos reales. */
  openReservation: () => void;
  /** Cierra el panel de "Nueva reserva". */
  closeReservation: () => void;
};

const PAD = 8;
const CARD_W = 300;
const ILLUSTRATION_CARD_W = 320;
const GAP = 14;

type Rect = { top: number; left: number; width: number; height: number };
type Placement = "bottom" | "top" | "right" | "left" | "center";

function buildSteps(openReservation: () => void, closeReservation: () => void): TourStep[] {
  return [
    {
      selector: null,
      illustration: null,
      icon: CalendarClock,
      title: "Bienvenida a la Agenda del día",
      description: "Acá ves las reservas del día organizadas por hora. Te mostramos rápido cómo moverte y crear/reprogramar una cita.",
      onEnter: closeReservation,
    },
    {
      selector: '[data-tour="agenda-view-toggle"]',
      illustration: null,
      icon: CalendarDays,
      title: "Calendario o WhatsApp",
      description: "\"Calendario\" es la planilla de horarios. \"WhatsApp\" muestra reservas pendientes de validar por ese medio antes de confirmarlas.",
      onEnter: closeReservation,
    },
    {
      selector: '[data-tour="agenda-date-nav"]',
      illustration: null,
      icon: CalendarDays,
      title: "Elegir el día",
      description: "\"Hoy\" vuelve a la fecha actual. Tocá un día de la semana, usá las flechas, o el campo de fecha para saltar a cualquier día.",
      onEnter: closeReservation,
    },
    {
      selector: '[data-tour="agenda-new-btn"]',
      illustration: null,
      icon: Plus,
      title: "Nueva reserva",
      description: "Abre el formulario para agendar una cita: elegís clienta, servicio, operaria y horario. Te lo mostramos abierto en el siguiente paso.",
      onEnter: closeReservation,
    },
    {
      selector: '[data-tour="agenda-res-services"]',
      illustration: null,
      icon: Search,
      title: "Agregar servicios",
      description: "Buscá y agregá uno o más servicios. Es opcional acá: si no agregás ninguno, se reserva solo el bloque de horario con la duración de abajo.",
      onEnter: openReservation,
    },
    {
      selector: '[data-tour="agenda-res-client"]',
      illustration: null,
      icon: User,
      title: "Clienta",
      description: "Buscá por nombre, apellido o teléfono. Si es nueva, tocá el botón \"+\" para registrarla sin salir de este panel.",
      onEnter: openReservation,
    },
    {
      selector: '[data-tour="agenda-res-time"]',
      illustration: null,
      icon: MousePointerClick,
      title: "Hora y duración",
      description: "Hora en que arranca la reserva. La duración se calcula sola si agregaste servicios; si no, la definís vos manualmente.",
      onEnter: openReservation,
    },
    {
      selector: '[data-tour="agenda-res-pro"]',
      illustration: null,
      icon: UserCog,
      title: "Operaria / puesto",
      description: "Asigná quién va a atender — opcional, podés dejarla \"Sin asignar\" y elegirla después desde el Tablero de atención.",
      onEnter: openReservation,
    },
    {
      selector: '[data-tour="agenda-res-confirm"]',
      illustration: null,
      icon: CheckCircle2,
      title: "Confirmar reserva",
      description: "Esto solo agenda — no cobra nada. Si la clienta es nueva, vas a ver pedido un adelanto obligatorio antes de poder confirmar.",
      onEnter: openReservation,
    },
    {
      selector: '[data-tour="agenda-grid"]',
      illustration: null,
      icon: MousePointerClick,
      title: "La planilla horaria",
      description: "Cada fila es un horario. Tocá una casilla vacía para crear una reserva justo en esa hora — es un atajo más rápido que el botón \"Nueva\".",
      onEnter: closeReservation,
    },
    {
      selector: null,
      illustration: "overview",
      icon: CalendarClock,
      title: "Así se ve una reserva",
      description: "Cada tarjeta muestra el nombre de la clienta y el servicio. Tocá la flechita para ver más detalles: teléfono, edad, tipo de ojo y operaria asignada.",
      onEnter: closeReservation,
    },
    {
      selector: null,
      illustration: "drag",
      icon: GripVertical,
      title: "Reprogramar arrastrando",
      description: "Arrastrá una tarjeta desde su asa (⋮⋮) y soltala en otra hora para cambiar el horario de la reserva, sin tener que editarla a mano.",
      onEnter: closeReservation,
    },
    {
      selector: null,
      illustration: "venta",
      icon: Wallet,
      title: "Pasar a venta",
      description: "Cuando la clienta ya está en el salón, tocá \"Pasar a venta\" para mandar esa reserva directo al POS y cobrarla.",
      onEnter: closeReservation,
    },
    {
      selector: '[data-tour="agenda-print-btn"]',
      illustration: null,
      icon: Printer,
      title: "Imprimir",
      description: "Genera una planilla imprimible del día — útil para pegarla en el salón o repasar el día sin la pantalla.",
      onEnter: closeReservation,
    },
  ];
}

// ─── Tarjeta de reserva simulada (solo ilustrativa) ─────────────────────────

function MockAgendaCard({ highlight }: { highlight: Illustration }) {
  const ring = (zone: Illustration) =>
    highlight === zone ? "ring-2 ring-[#107c10] ring-offset-2 rounded-md" : "";

  return (
    <div className="flex items-start gap-1">
      <div className={`mt-1 flex h-6 w-5 shrink-0 items-center justify-center rounded border border-[#c8c6c4] bg-white text-[#605e5c] ${ring("drag")}`}>
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-[132px] max-w-[180px] rounded-md border-2 border-[#a7d3f0] bg-[#eef6ff] p-1.5 text-left shadow-sm">
        <div className="truncate text-[11px] font-bold leading-tight text-[#004578]">Valeria (ejemplo)</div>
        <div className="flex items-center gap-1">
          <span className="truncate text-[10px] text-[#323130]">Lifting de Pestañas</span>
        </div>
        <div className={`mt-0.5 inline-flex items-center opacity-70 ${ring("overview")}`}>
          <ChevronDown className="h-3 w-3" />
        </div>
        <div className="mt-1.5 border-t border-current/15 pt-1">
          <span className={`inline-block rounded border border-[#0078d4]/40 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#0078d4] ${ring("venta")}`}>
            Pasar a venta
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AgendaTutorialModal({ onClose, storageKey, openReservation, closeReservation }: Props) {
  const stepsRef = useRef<TourStep[]>(buildSteps(openReservation, closeReservation));
  const steps = stepsRef.current;

  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const finish = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // localStorage puede fallar en modo privado — no bloquea el cierre.
    }
    closeReservation();
    onClose();
  };

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
      } else if (attempts < 12) {
        attempts += 1;
        window.setTimeout(locate, 80);
      } else {
        setRect(null);
      }
    };
    const t = window.setTimeout(locate, 40);
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

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

  const next = () => (isLast ? finish() : setStepIndex((i) => Math.min(steps.length - 1, i + 1)));
  const prev = () => setStepIndex((i) => Math.max(0, i - 1));

  const isIllustration = Boolean(step.illustration);
  const cardW = isIllustration ? ILLUSTRATION_CARD_W : CARD_W;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardHEstimate = isIllustration ? 330 : 210;

  let placement: Placement = "center";
  let cardTop = vh / 2 - cardHEstimate / 2;
  let cardLeft = vw / 2 - cardW / 2;

  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceRight = vw - (rect.left + rect.width);
    const spaceLeft = rect.left;

    if (spaceBelow >= cardHEstimate + GAP) {
      placement = "bottom";
      cardTop = rect.top + rect.height + GAP;
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    } else if (spaceAbove >= cardHEstimate + GAP) {
      placement = "top";
      cardTop = rect.top - GAP - cardHEstimate;
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    } else if (spaceRight >= cardW + GAP) {
      placement = "right";
      cardTop = rect.top + rect.height / 2 - cardHEstimate / 2;
      cardLeft = rect.left + rect.width + GAP;
    } else if (spaceLeft >= cardW + GAP) {
      placement = "left";
      cardTop = rect.top + rect.height / 2 - cardHEstimate / 2;
      cardLeft = rect.left - GAP - cardW;
    } else {
      placement = "bottom";
      cardTop = Math.min(rect.top + rect.height + GAP, vh - cardHEstimate - 12);
      cardLeft = rect.left + rect.width / 2 - cardW / 2;
    }
    cardLeft = Math.max(12, Math.min(cardLeft, vw - cardW - 12));
    cardTop = Math.max(12, Math.min(cardTop, vh - 12));
  }

  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <style>{`
        @keyframes agendaTourPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.85), 0 0 24px 4px rgba(16,124,16,0.55), 0 0 0 9999px rgba(10,14,12,0.82); }
          50%      { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 34px 10px rgba(16,124,16,0.8), 0 0 0 9999px rgba(10,14,12,0.82); }
        }
        .agenda-tour-ring { animation: agendaTourPulse 1.8s ease-in-out infinite; }
      `}</style>

      {rect ? (
        <div
          className="agenda-tour-ring pointer-events-none fixed rounded-lg border-2 border-[#107c10] transition-all duration-300 ease-out"
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
              : placement === "top" ? cardTop + cardHEstimate - 6
              : Math.max(cardTop + 16, Math.min(rect.top + rect.height / 2 - 6, cardTop + cardHEstimate - 22)),
            left:
              placement === "right" ? cardLeft - 6
              : placement === "left" ? cardLeft + cardW - 6
              : Math.max(cardLeft + 16, Math.min(rect.left + rect.width / 2 - 6, cardLeft + cardW - 22)),
          }}
        />
      )}

      <div
        className="fixed flex flex-col overflow-hidden rounded-sm border border-[#d2d0ce] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
      >
        <div className="relative flex items-start gap-3 bg-[#094732] px-4 pb-4 pt-4">
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

        {isIllustration && (
          <div className="flex justify-center bg-[#faf9f8] px-4 pb-3 pt-3">
            <MockAgendaCard highlight={step.illustration} />
          </div>
        )}

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
              {isLast ? "Entendido" : "Siguiente"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
