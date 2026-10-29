import type { RetoqueRow } from "@/core/services/client/client.service";

export const fieldClass =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

export const RANGOS = [7, 15, 30, 60];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Las fechas llegan en hora de La Paz y sin zona: se formatean a mano, sin
// pasar por Date, para que el navegador no las corra de día.
export const formatDay = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return `${day} ${MESES[month - 1]} ${year}`;
};

export const formatTime = (isoDateTime: string) => isoDateTime.slice(11, 16);

export const formatAppointment = (isoDateTime: string) => `${formatDay(isoDateTime)} · ${formatTime(isoDateTime)}`;

// El backend manda microsegundos ("...35.600533Z"); se recortan a milisegundos
// para que cualquier navegador lo parsee.
export const parseUtc = (iso: string) => Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));

export const haceLabel = (ms: number) => {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${plural(Math.floor(horas / 24), "día", "días")}`;
};

export const diasLabel = (row: RetoqueRow) => {
  if (row.vencido) return `Vencido · hace ${plural(Math.abs(row.dias_restantes), "día", "días")}`;
  if (row.dias_restantes === 0) return "Hoy";
  return plural(row.dias_restantes, "día", "días");
};
