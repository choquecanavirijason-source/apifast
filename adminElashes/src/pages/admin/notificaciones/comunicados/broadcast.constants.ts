import type {
  Broadcast,
  BroadcastAudience,
  BroadcastKind,
  BroadcastStatus,
  EmailDelivery,
  PushDelivery,
} from "@/core/services/broadcast/broadcast.service";

interface KindOption {
  id: BroadcastKind;
  label: string;
  hint: string;
  badgeClass: string;
}

export const KIND_OPTIONS: KindOption[] = [
  {
    id: "aviso",
    label: "Aviso",
    hint: "Cierres, feriados, cambios de horario. Les llega a todas las del grupo.",
    badgeClass: "bg-sky-50 text-sky-700",
  },
  {
    id: "promocion",
    label: "Promoción",
    hint: "Descuentos y ofertas. No les llega a quienes tienen las notificaciones apagadas.",
    badgeClass: "bg-amber-50 text-amber-700",
  },
  {
    id: "novedad",
    label: "Novedad",
    hint: "Servicios o productos nuevos. No les llega a quienes tienen las notificaciones apagadas.",
    badgeClass: "bg-violet-50 text-violet-700",
  },
];

export const kindOption = (kind: BroadcastKind) => KIND_OPTIONS.find((option) => option.id === kind)!;

/** Como en el backend: no les llegan a quienes apagaron sus notificaciones. */
export const MARKETING_KINDS: BroadcastKind[] = ["promocion", "novedad"];

interface AudienceOption {
  id: BroadcastAudience;
  label: string;
  /** Cómo se lee la ventana de días; null = no usa días. */
  window: "next" | "last" | null;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { id: "all", label: "Todas las clientas", window: null },
  { id: "upcoming_appointment", label: "Con cita próxima", window: "next" },
  { id: "retouch_due", label: "Con retoque o retiro próximo", window: "next" },
  { id: "inactive", label: "Sin visitas recientes", window: "last" },
  { id: "selected", label: "Clientas específicas", window: null },
];

export const AUDIENCE_DAYS = [7, 15, 30, 60, 90, 180];
export const DEFAULT_AUDIENCE_DAYS = 30;

const audienceOption = (audience: BroadcastAudience) => AUDIENCE_OPTIONS.find((option) => option.id === audience)!;

export function daysLabel(audience: BroadcastAudience, days: number): string {
  return audienceOption(audience).window === "last" ? `En los últimos ${days} días` : `En los próximos ${days} días`;
}

/** "Con cita próxima (30 días) · Centro" para el historial. */
export function audienceSummary(broadcast: Broadcast): string {
  const option = audienceOption(broadcast.audience);
  if (broadcast.audience === "selected") return option.label;
  const days = option.window ? ` (${broadcast.audience_days ?? DEFAULT_AUDIENCE_DAYS} días)` : "";
  return `${option.label}${days} · ${broadcast.branch_name ?? "Todas las sucursales"}`;
}

export const STATUS_META: Record<BroadcastStatus, { label: string; className: string }> = {
  sending: { label: "Enviando…", className: "bg-sky-50 text-sky-700" },
  sent: { label: "Enviado", className: "bg-emerald-50 text-emerald-700" },
  interrupted: { label: "Interrumpido", className: "bg-rose-50 text-rose-700" },
};

/** Resultado por clienta y canal en el detalle (null = pendiente o no se pidió). */
export const DELIVERY_META: Record<PushDelivery | EmailDelivery, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Falló", className: "bg-rose-50 text-rose-700" },
  no_app: { label: "Sin app", className: "bg-slate-100 text-slate-500" },
  no_email: { label: "Sin correo", className: "bg-slate-100 text-slate-500" },
};
