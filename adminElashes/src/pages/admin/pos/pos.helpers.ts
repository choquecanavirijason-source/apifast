import type { CartLine } from "./pos.types";
import type { ServiceOption } from "../../../core/services/agenda/agenda.service";

export const POS_DRAFT_STORAGE_KEY_PREFIX = "pos-sale-draft-v1";

export const getLocalDateInputValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getLocalTimeValue = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const formatLocalDateTime = (date: Date) => {
  const y  = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d  = String(date.getDate()).padStart(2, "0");
  const h  = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s  = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

export const getPosDraftStorageKey = (branchId: number | null) =>
  `${POS_DRAFT_STORAGE_KEY_PREFIX}:${branchId ?? "global"}`;

export const createLocalId = () => {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `local-${timePart}-${randomPart}`;
};

export const isCartLine = (value: unknown): value is CartLine => {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  const statusIsValid = line.status === undefined || line.status === "pending" || line.status === "in_service";
  const withoutTimeIsValid = line.without_time === undefined || typeof line.without_time === "boolean";
  return (
    typeof line.localId === "string" &&
    typeof line.service_id === "string" &&
    typeof line.professional_id === "string" &&
    typeof line.date === "string" &&
    typeof line.time === "string" &&
    statusIsValid &&
    withoutTimeIsValid &&
    typeof line.duration_minutes === "number" &&
    Number.isFinite(line.duration_minutes) &&
    typeof line.price === "number" &&
    Number.isFinite(line.price)
  );
};

export const normalizeCartLine = (line: CartLine): CartLine => ({
  ...line,
  without_time: line.without_time ?? false,
  status: line.status === "in_service" ? "in_service" : "pending",
});

export const applySaleExecutionSchedule = (lines: CartLine[]): CartLine[] => {
  let cursor = Date.now();
  return lines.map((line) => {
    if (line.time_manual) {
      cursor += Math.max(Number(line.duration_minutes) || 60, 1) * 60 * 1000;
      return normalizeCartLine({ ...line, without_time: false });
    }
    const start = new Date(cursor);
    const durationMs = Math.max(Number(line.duration_minutes) || 60, 1) * 60 * 1000;
    cursor += durationMs;
    return normalizeCartLine({
      ...line,
      date: getLocalDateInputValue(start),
      time: getLocalTimeValue(start),
      without_time: false,
    });
  });
};

export const applySellerToCartLines = (lines: CartLine[], sellerId: string): CartLine[] => {
  const trimmed = sellerId.trim();
  if (!trimmed) return lines;
  return lines.map((line) =>
    line.professional_id ? line : normalizeCartLine({ ...line, professional_id: trimmed })
  );
};

export const prepareCartLinesForTicketCheckout = (
  lines: CartLine[],
  options: { sellerId: string; applySchedule: boolean }
): CartLine[] => {
  const withSeller = applySellerToCartLines(lines, options.sellerId);
  return options.applySchedule ? applySaleExecutionSchedule(withSeller) : withSeller;
};

export const createDefaultLine = (service?: ServiceOption): CartLine => ({
  localId: createLocalId(),
  service_id: service ? String(service.id) : "",
  professional_id: "",
  date: getLocalDateInputValue(),
  time: getLocalTimeValue(),
  without_time: false,
  status: "pending",
  duration_minutes: service?.duration_minutes ?? 60,
  price: service?.price ?? 0,
});

export const toDateAndTimeInputValues = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: getLocalDateInputValue(), time: "09:00", without_time: false };
  }
  const date = getLocalDateInputValue(parsed);
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  return { date, time, without_time: time === "09:00" };
};

export const formatHourMinute = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
