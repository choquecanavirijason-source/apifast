import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Banknote, BadgeCheck, CheckCircle2, Download, List, X } from "lucide-react";
import CommissionPaymentsTab from "./CommissionPaymentsTab";
import { AgendaService, type ProfessionalForSelect, type TicketItem } from "@/core/services/agenda/agenda.service";
import { TrackingService, type TrackingResponse } from "@/core/services/tracking/tracking.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { getApiErrorMessage } from "@/core/utils/apiError";
import useAuth from "@/core/hooks/useAuth";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, SectionCard, SegmentedTabs, StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import {
  formatCommissionRatePercent,
  getTicketCommission,
  getTicketPriceTotal,
} from "./professionalCommission.utils";

// Una fila por cita (no un agregado por operaria) — el PDF de comisiones
// tiene que mostrar el detalle real (cliente, servicio, fecha), no solo
// cuántas hizo cada una.
export interface CommissionExportRow {
  professional_name: string;
  client_name: string;
  services: string;
  fecha: string;
  hora: string;
  status: string;
  caja: number;
  comision: number;
}

export interface CommissionExportTotals {
  caja: number;
  comision: number;
  pagado: number;
  pendiente: number;
}

const fieldClass =
  "w-full rounded-lg border border-[var(--ui-border-strong)] bg-white px-3 py-2 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] outline-none transition focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/35 disabled:bg-[var(--ui-surface-muted)] disabled:text-[var(--ui-text-muted)]";

const CARD_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  waiting: "En espera",
  in_service: "En servicio",
  completed: "Completado",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  waiting: "bg-blue-100 text-blue-800",
  in_service: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  confirmed: "bg-violet-100 text-violet-800",
};

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// Fila con la comisión pagada: verde suave del tema (acento mezclado con la
// superficie, opaco) — el texto oscuro normal conserva buen contraste.
const PAID_ROW_CLASS = "bg-[color-mix(in_srgb,var(--ui-accent)_9%,var(--ui-surface))]";

// Recorta microsegundos ("...12.345678+00:00") para que cualquier navegador lo parsee.
const parseIso = (iso: string) => new Date(iso.replace(/(\.\d{3})\d+/, "$1"));

const paidDateLabel = (iso?: string | null) =>
  iso
    ? parseIso(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

/** Por qué no se puede marcar el ticket para pagar (null = se puede). */
function payBlockReason(t: TicketItem, canPay: boolean): string | null {
  if (!canPay) return "No tienes permiso para confirmar pagos de comisiones.";
  if (t.status !== "completed") return "Solo se pagan tickets completados.";
  if (!t.professional_id) return "El ticket no tiene operaria asignada.";
  if (getTicketCommission(t) <= 0) return "Este ticket no tiene comisión.";
  return null;
}

/** Checkbox de "marcar todos" con estado indeterminado (React no tiene la
 *  prop `indeterminate`: se fija en el elemento con un ref). */
function SelectAllCheckbox({
  checked,
  indeterminate,
  disabled,
  title,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  title: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  // El texto va dentro de la misma <label>: un clic en "Seleccionar todos"
  // también cambia la casilla, y el tooltip cubre todo el conjunto.
  return (
    <label
      className={`flex items-center gap-1.5 select-none whitespace-nowrap rounded-md px-1 py-0.5 text-[11px] font-medium leading-none transition-colors ${
        disabled
          ? "cursor-not-allowed text-[var(--ui-text-muted)] opacity-60"
          : "cursor-pointer text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
      }`}
      title={title}
    >
      <input
        ref={ref}
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 cursor-[inherit] accent-[var(--ui-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>Seleccionar todos</span>
    </label>
  );
}

/** El lote es todo o nada: el servidor devuelve qué tickets lo impidieron. */
function payErrorMessage(err: unknown, tickets: TicketItem[]): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail as
      | { message?: string; errores?: { id: number; motivo: string }[] }
      | undefined;
    if (detail && typeof detail === "object" && Array.isArray(detail.errores)) {
      const label = (id: number) => {
        const t = tickets.find((x) => x.id === id);
        return t ? (t.ticket_code ?? `#${t.id}`) : `#${id}`;
      };
      return `${detail.message ?? "No se registró ningún pago."} ${detail.errores
        .map((e) => `${label(e.id)}: ${e.motivo}`)
        .join(" · ")}`;
    }
  }
  return getApiErrorMessage(err, "No se pudo registrar el pago.");
}

function getDurationLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const mins = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  return `${mins} min`;
}

export default function ProfessionalServiceHistory() {
  const { user, isAdmin, hasRole, hasPermissionByName } = useAuth();
  const canSeeCards = isAdmin() || hasRole("Operaria");
  const isOperaria = hasRole("Operaria") && !isAdmin();
  const canPay = isAdmin() || hasPermissionByName("commissions:pay");
  const canVoid = isAdmin() || hasPermissionByName("commissions:void");

  // Selección en pantalla para "Confirmar pago" (solo ids; no se guarda nada
  // hasta confirmar el diálogo).
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [confirmPayOpen, setConfirmPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voidTarget, setVoidTarget] = useState<TicketItem | null>(null);
  const [voidMotivo, setVoidMotivo] = useState("");
  const [voiding, setVoiding] = useState(false);

  const [activeTab, setActiveTab] = useState<"tickets" | "comisiones">("tickets");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [trackings, setTrackings] = useState<TrackingResponse[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [commissionRows, setCommissionRows] = useState<CommissionExportRow[]>([]);
  const [commissionTotals, setCommissionTotals] = useState<CommissionExportTotals>({
    caja: 0,
    comision: 0,
    pagado: 0,
    pendiente: 0,
  });
  const handleCommissionStatsChange = useCallback(
    (rows: CommissionExportRow[], totals: CommissionExportTotals) => {
      setCommissionRows(rows);
      setCommissionTotals(totals);
    },
    []
  );

  const trackingByAppointment = useMemo(() => {
    const map = new Map<number, TrackingResponse>();
    trackings.forEach((t) => { if (t.appointment_id) map.set(t.appointment_id, t); });
    return map;
  }, [trackings]);

  const loadProfessionals = useCallback(async () => {
    try {
      const data = await AgendaService.listProfessionalsForSelect({
        limit: 200,
        role_name: "Operaria",
        branch_id: activeBranchId ?? undefined,
      });
      setProfessionals(data);
    } catch (err) {
      console.error("Error cargando profesionales:", err);
      setProfessionals([]);
    }
  }, [activeBranchId]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settled = await Promise.allSettled([
        AgendaService.listTickets({
          limit: 500,
          branch_id: activeBranchId ?? undefined,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        }),
        TrackingService.list({ limit: 500 }),
      ]);

      if (settled[0].status === "fulfilled") {
        setTickets(settled[0].value);
      } else {
        console.error("Error cargando tickets:", settled[0].reason);
        setTickets([]);
        setError("No se pudo cargar el listado de tickets.");
      }

      if (settled[1].status === "fulfilled") {
        setTrackings(settled[1].value);
      } else {
        console.error("Error cargando trackings:", settled[1].reason);
        setTrackings([]);
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError("No se pudo cargar el listado de tickets.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fromDate, toDate]);

  useEffect(() => { void loadProfessionals(); }, [loadProfessionals]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!isOperaria || !user?.id || professionals.length === 0) return;
    const own = professionals.find((p) => p.id === user.id);
    if (own) setSelectedProfessionalId(own.id);
  }, [isOperaria, user?.id, professionals]);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const professionalStats = useMemo(() => {
    const map = new Map<number, { name: string; count: number; completedCount: number; commission: number }>();
    professionals.forEach((p) =>
      map.set(p.id, { name: p.username, count: 0, completedCount: 0, commission: 0 })
    );
    tickets.forEach((ticket) => {
      if (!ticket.professional_id) return;
      const commission = getTicketCommission(ticket);
      const existing = map.get(ticket.professional_id);
      if (existing) {
        existing.count++;
        if (ticket.status === "completed") {
          existing.completedCount++;
          existing.commission += commission;
        }
      } else {
        map.set(ticket.professional_id, {
          name: ticket.professional_name ?? `#${ticket.professional_id}`,
          count: 1,
          completedCount: ticket.status === "completed" ? 1 : 0,
          commission,
        });
      }
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.commission - a.commission || b.completedCount - a.completedCount);
  }, [professionals, tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (selectedProfessionalId !== null && ticket.professional_id !== selectedProfessionalId) return false;
      return true;
    });
  }, [tickets, selectedProfessionalId]);

  const selectedProfName = useMemo(
    () => selectedProfessionalId !== null
      ? (professionalStats.find((p) => p.id === selectedProfessionalId)?.name ?? null)
      : null,
    [selectedProfessionalId, professionalStats]
  );

  const completedTickets = useMemo(
    () => filteredTickets.filter((t) => t.status === "completed"),
    [filteredTickets]
  );

  const totalRevenue = useMemo(
    () => completedTickets.reduce((s, t) => s + getTicketPriceTotal(t), 0),
    [completedTickets]
  );

  const totalCommission = useMemo(
    () => completedTickets.reduce((s, t) => s + getTicketCommission(t), 0),
    [completedTickets]
  );

  // Cambiar filtros (sucursal, operaria, fechas) o de pestaña limpia la
  // selección: lo marcado podría dejar de verse y pagarse sin querer.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeBranchId, selectedProfessionalId, fromDate, toDate, activeTab]);

  // Tras "Actualizar", conserva solo lo que sigue visible y pagable.
  useEffect(() => {
    setSelectedIds((current) => {
      if (current.size === 0) return current;
      const still = new Set(
        filteredTickets
          .filter((t) => current.has(t.id) && !t.pagado && payBlockReason(t, canPay) === null)
          .map((t) => t.id),
      );
      return still.size === current.size ? current : still;
    });
  }, [filteredTickets, canPay]);

  const toggleSelected = useCallback((id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedTickets = useMemo(
    () => filteredTickets.filter((t) => selectedIds.has(t.id)),
    [filteredTickets, selectedIds],
  );

  // Pendientes de pago y pagables de la lista filtrada (todas las páginas):
  // lo único que el "marcar todos" de la cabecera puede seleccionar.
  const eligibleIds = useMemo(
    () => filteredTickets.filter((t) => !t.pagado && payBlockReason(t, canPay) === null).map((t) => t.id),
    [filteredTickets, canPay],
  );
  const selectedEligibleCount = useMemo(
    () => eligibleIds.filter((id) => selectedIds.has(id)).length,
    [eligibleIds, selectedIds],
  );
  const allEligibleSelected = eligibleIds.length > 0 && selectedEligibleCount === eligibleIds.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds));
  }, [allEligibleSelected, eligibleIds]);

  const selectedSummary = useMemo(() => {
    const byPro = new Map<string, { count: number; total: number }>();
    selectedTickets.forEach((t) => {
      const name = t.professional_name ?? `#${t.professional_id}`;
      const entry = byPro.get(name) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += getTicketCommission(t);
      byPro.set(name, entry);
    });
    const total = selectedTickets.reduce((s, t) => s + getTicketCommission(t), 0);
    return { byPro: Array.from(byPro.entries()), total };
  }, [selectedTickets]);

  const totalPaidCommission = useMemo(
    () => filteredTickets.reduce((s, t) => s + (t.pagado ? (t.pagado_monto ?? getTicketCommission(t)) : 0), 0),
    [filteredTickets],
  );

  const handleConfirmPay = async () => {
    const ids = selectedTickets.map((t) => t.id);
    if (ids.length === 0) return;
    setPaying(true);
    try {
      const result = await AgendaService.payCommissions(ids);
      const byId = new Map(result.pagados.map((p) => [p.id, p]));
      setTickets((current) =>
        current.map((t) => {
          const p = byId.get(t.id);
          return p
            ? {
                ...t,
                pagado: true,
                pagado_en: p.pagado_en,
                pagado_por: p.pagado_por,
                pagado_por_nombre: result.pagado_por_nombre,
                pagado_monto: p.pagado_monto,
              }
            : t;
        }),
      );
      setSelectedIds(new Set());
      setConfirmPayOpen(false);
      toast.success(
        `Pago registrado: ${result.tickets} ticket${result.tickets !== 1 ? "s" : ""} · ` +
          `${result.operarias} operaria${result.operarias !== 1 ? "s" : ""} · ${moneyFormatter.format(result.total)}.`,
      );
    } catch (err) {
      // Todo o nada: no se guardó ninguno; la selección queda para corregirla.
      setConfirmPayOpen(false);
      toast.error(payErrorMessage(err, tickets), { autoClose: 8000 });
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const updated = await AgendaService.voidCommissionPayment(voidTarget.id, voidMotivo);
      setTickets((current) =>
        current.map((t) =>
          t.id === updated.id
            ? {
                ...t,
                pagado: updated.pagado,
                pagado_en: updated.pagado_en,
                pagado_por: updated.pagado_por,
                pagado_por_nombre: updated.pagado_por_nombre,
                pagado_monto: updated.pagado_monto,
              }
            : t,
        ),
      );
      toast.success(`Pago anulado: ${voidTarget.ticket_code ?? `#${voidTarget.id}`}.`);
      setVoidTarget(null);
      setVoidMotivo("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo anular el pago."));
    } finally {
      setVoiding(false);
    }
  };

  const columns = useMemo<DataTableColumn<TicketItem>[]>(() => [
    {
      key: "ticket_code",
      header: "Código",
      sortable: true,
      render: (t) => (
        <span className="font-mono text-xs font-semibold text-[var(--ui-accent)]">
          {t.ticket_code ?? `#${t.id}`}
        </span>
      ),
    },
    {
      key: "client_name",
      header: "Cliente",
      sortable: true,
      render: (t) => <span className="font-semibold text-slate-800">{t.client_name || "Sin cliente"}</span>,
    },
    {
      key: "service_label",
      header: "Servicio(s)",
      sortable: true,
      getValue: (t) => t.service_names?.join(" · ") ?? (t.service_name ?? ""),
      render: (t) => (
        <span className="text-xs text-[var(--ui-text)]">
          {t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? "Sin servicio")}
        </span>
      ),
    },
    {
      key: "professional_name",
      header: "Operaria",
      sortable: true,
      render: (t) => (
        <span className={`text-xs ${t.professional_name ? "font-medium text-[var(--ui-text)]" : "text-[var(--ui-text-muted)]"}`}>
          {t.professional_name ?? "Sin asignar"}
        </span>
      ),
    },
    {
      key: "start_time",
      header: "Fecha",
      sortable: true,
      getValue: (t) => t.start_time ?? "",
      render: (t) =>
        t.start_time ? (
          <div className="text-xs">
            <p className="font-medium text-[var(--ui-text)]">
              {new Date(t.start_time).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <p className="text-[var(--ui-text-muted)]">
              {new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ) : <span className="text-[var(--ui-text-muted)]">—</span>,
    },
    {
      key: "duration",
      header: "Duración",
      getValue: (t) => t.start_time,
      render: (t) => (
        <span className="text-xs text-[var(--ui-text-muted)]">{getDurationLabel(t.start_time, t.end_time)}</span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (t) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      getValue: (t) => String(getTicketPriceTotal(t)),
      render: (t) => {
        const total = getTicketPriceTotal(t);
        return (
          <span className={`text-xs font-semibold tabular-nums ${total > 0 ? "text-emerald-700" : "text-[var(--ui-text-muted)]"}`}>
            {total > 0 ? moneyFormatter.format(total) : "—"}
          </span>
        );
      },
    },
    {
      key: "commission",
      header: "Comisión",
      sortable: true,
      getValue: (t) => String(getTicketCommission(t)),
      render: (t) => {
        if (t.status !== "completed") {
          return <span className="text-xs text-[var(--ui-text-muted)]">—</span>;
        }
        const commission = getTicketCommission(t);
        return (
          <span className={`text-xs font-semibold tabular-nums ${commission > 0 ? "text-[var(--ui-accent)]" : "text-[var(--ui-text-muted)]"}`}>
            {commission > 0 ? moneyFormatter.format(commission) : "—"}
          </span>
        );
      },
    },
    {
      key: "branch_name",
      header: "Sucursal",
      sortable: true,
      render: (t) => (
        <span className="text-xs text-[var(--ui-text-muted)]">{t.branch_name ?? "—"}</span>
      ),
    },
    {
      key: "notes",
      header: "Notas",
      getValue: (t) => trackingByAppointment.get(t.id)?.design_notes?.trim() ?? "",
      render: (t) => {
        const notes = trackingByAppointment.get(t.id)?.design_notes?.trim();
        return notes ? (
          <span className="line-clamp-2 max-w-45 text-xs text-[var(--ui-text)]" title={notes}>{notes}</span>
        ) : (
          <span className="text-xs text-[var(--ui-text-muted)]">—</span>
        );
      },
    },
    {
      key: "questionnaire",
      header: "Cuestionario",
      getValue: (t) => trackingByAppointment.get(t.id)?.questionnaire?.title ?? "",
      render: (t) => {
        const q = trackingByAppointment.get(t.id)?.questionnaire?.title;
        return q ? (
          <span className="text-xs text-[var(--ui-accent)]">{q}</span>
        ) : (
          <span className="text-xs text-[var(--ui-text-muted)]">—</span>
        );
      },
    },
    {
      key: "pago",
      header: "Pago",
      headerExtra: (
        <SelectAllCheckbox
          checked={allEligibleSelected}
          indeterminate={selectedEligibleCount > 0 && !allEligibleSelected}
          disabled={eligibleIds.length === 0}
          title={
            !canPay
              ? "No tienes permiso para confirmar pagos de comisiones."
              : eligibleIds.length === 0
                ? "No hay tickets pendientes de pago en la lista."
                : allEligibleSelected
                  ? "Desmarcar todos"
                  : `Seleccionar todas las comisiones pendientes de pago (${eligibleIds.length})`
          }
          onChange={toggleSelectAll}
        />
      ),
      getValue: (t) => (t.pagado ? "Pagado" : ""),
      render: (t) => {
        if (t.pagado) {
          const detail = [
            t.pagado_en ? `Pagado el ${paidDateLabel(t.pagado_en)}` : "Pagado",
            t.pagado_por_nombre ? `por ${t.pagado_por_nombre}` : "",
          ].filter(Boolean).join(" ");
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-accent)] px-2 py-0.5 text-[10px] font-bold text-white"
                title={detail}
              >
                <CheckCircle2 className="h-3 w-3" />
                Pagado
              </span>
              {canVoid && (
                <button
                  type="button"
                  onClick={() => { setVoidMotivo(""); setVoidTarget(t); }}
                  className="text-[10px] font-semibold text-[var(--ui-text-muted)] underline-offset-2 hover:text-rose-700 hover:underline"
                >
                  Anular
                </button>
              )}
            </div>
          );
        }
        const reason = payBlockReason(t, canPay);
        const label = `Marcar para pagar la comisión de ${t.ticket_code ?? `#${t.id}`}`;
        return (
          <label
            className={`inline-flex p-1 ${reason ? "cursor-not-allowed" : "cursor-pointer"}`}
            title={reason ?? "Marcar para confirmar el pago"}
          >
            <input
              type="checkbox"
              className="h-4 w-4 cursor-[inherit] accent-[var(--ui-accent)] disabled:opacity-40"
              checked={selectedIds.has(t.id)}
              disabled={reason !== null}
              onChange={() => toggleSelected(t.id)}
              aria-label={label}
            />
          </label>
        );
      },
    },
  ], [
    trackingByAppointment, selectedIds, canPay, canVoid, toggleSelected,
    allEligibleSelected, selectedEligibleCount, eligibleIds, toggleSelectAll,
  ]);

  // Rango de fechas en texto, para el subtítulo del PDF — igual en las dos
  // pestañas ya que ambas comparten los mismos filtros de arriba.
  const dateRangeLabel = fromDate || toDate
    ? ` · ${fromDate ? new Date(fromDate).toLocaleDateString("es-BO") : "inicio"} — ${toDate ? new Date(toDate).toLocaleDateString("es-BO") : "hoy"}`
    : "";

  const handleDownloadPdfTickets = () => {
    void generateTablePdf({
      title: "Historial de tickets",
      subtitle: (selectedProfName ? `Operaria: ${selectedProfName}` : "Todas las operarias") + dateRangeLabel,
      filename: "historial-tickets",
      orientation: "landscape",
      meta: [
        { label: "Tickets", value: String(filteredTickets.length) },
        { label: "Completados", value: String(completedTickets.length) },
        { label: "Ingresos", value: moneyFormatter.format(totalRevenue) },
        { label: "Comisiones", value: moneyFormatter.format(totalCommission) },
        { label: "Comisiones pagadas", value: moneyFormatter.format(totalPaidCommission) },
      ],
      columns: [
        { header: "Código", key: "ticket_code" },
        { header: "Cliente", key: "client_name" },
        { header: "Servicio(s)", key: "services" },
        { header: "Operaria", key: "professional_name" },
        { header: "Fecha", key: "fecha" },
        { header: "Hora", key: "hora" },
        { header: "Estado", key: "status" },
        { header: "Precio", key: "precio" },
        { header: "Comisión", key: "comision" },
        { header: "Sucursal", key: "branch_name" },
        { header: "Pago", key: "pago" },
      ],
      rows: filteredTickets.map((t) => ({
        ticket_code: t.ticket_code ?? `#${t.id}`,
        client_name: t.client_name,
        services: t.service_names?.join(" · ") ?? t.service_name ?? "",
        professional_name: t.professional_name ?? "Sin asignar",
        fecha: t.start_time ? new Date(t.start_time).toLocaleDateString("es-BO") : "",
        hora: t.start_time
          ? new Date(t.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
          : "",
        status: STATUS_LABELS[t.status] ?? t.status,
        precio: getTicketPriceTotal(t) > 0 ? moneyFormatter.format(getTicketPriceTotal(t)) : "—",
        comision: t.status === "completed" && getTicketCommission(t) > 0
          ? moneyFormatter.format(getTicketCommission(t))
          : "—",
        branch_name: t.branch_name ?? "",
        pago: t.pagado
          ? `Pagado ${paidDateLabel(t.pagado_en)}`.trim()
          : t.status === "completed" && getTicketCommission(t) > 0
            ? "Pendiente"
            : "—",
      })),
    });
  };

  const handleDownloadPdfComisiones = () => {
    void generateTablePdf({
      title: "Comisiones y pagos — detalle de citas",
      subtitle: (selectedProfName ? `Operaria: ${selectedProfName}` : "Todas las operarias") + dateRangeLabel,
      filename: "comisiones-y-pagos",
      orientation: "landscape",
      meta: [
        { label: "Citas", value: String(commissionRows.length) },
        { label: "Caja", value: moneyFormatter.format(commissionTotals.caja) },
        { label: "Comisiones", value: moneyFormatter.format(commissionTotals.comision) },
        { label: "Pagado", value: moneyFormatter.format(commissionTotals.pagado) },
        { label: "Pendiente", value: moneyFormatter.format(commissionTotals.pendiente) },
      ],
      columns: [
        { header: "Operaria", key: "professional_name" },
        { header: "Cliente", key: "client_name" },
        { header: "Servicio(s)", key: "services" },
        { header: "Fecha", key: "fecha" },
        { header: "Hora", key: "hora" },
        { header: "Estado", key: "status" },
        { header: "Caja", key: "caja" },
        { header: "Comisión", key: "comision" },
      ],
      rows: commissionRows.map((r) => ({
        professional_name: r.professional_name,
        client_name: r.client_name,
        services: r.services,
        fecha: r.fecha,
        hora: r.hora,
        status: r.status,
        caja: r.caja > 0 ? moneyFormatter.format(r.caja) : "—",
        comision: r.comision > 0 ? moneyFormatter.format(r.comision) : "—",
      })),
    });
  };

  const handleDownloadPdf = () => {
    if (activeTab === "comisiones") {
      handleDownloadPdfComisiones();
    } else {
      handleDownloadPdfTickets();
    }
  };

  const renderToolbar = () => (
    <FilterActionBar
      left={<h2 className="text-lg font-semibold text-slate-800">Comisiones por operaria</h2>}
      right={
        <div className="flex items-center gap-2">
          {activeTab === "tickets" && canPay && (
            <Button
              size="sm"
              onClick={() => setConfirmPayOpen(true)}
              disabled={selectedTickets.length === 0}
              title={selectedTickets.length === 0 ? "Marca tickets en la columna Pago" : undefined}
              leftIcon={<BadgeCheck className="h-3.5 w-3.5" />}
            >
              Confirmar pago ({selectedTickets.length})
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={activeTab === "comisiones" ? commissionRows.length === 0 : filteredTickets.length === 0}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void loadHistory()}>Actualizar</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setFromDate(""); setToDate(""); setSelectedProfessionalId(null); }}
          >
            Limpiar filtros
          </Button>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Comisiones por operaria"
      subtitle="Rendimiento y comisiones por operaria. Incluye registro de pagos y liquidación de comisiones."
      variant="cards"
      toolbar={renderToolbar()}
    >
      {/* ── Tabs: Historial de tickets | Comisiones ───────────────────────── */}
      <SegmentedTabs
        options={[
          { id: "tickets", label: "Historial de tickets", icon: <List className="h-3.5 w-3.5" /> },
          { id: "comisiones", label: "Comisiones y pagos", icon: <Banknote className="h-3.5 w-3.5" /> },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Filtros (compartidos entre las dos pestañas: operaria, estado,
           rango de fechas) ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-3">
          {/* Operaria */}
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Operaria</label>
            {canSeeCards ? (
              <div className="mt-1 flex items-center gap-1.5">
                <select
                  value={selectedProfessionalId ?? ""}
                  onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                  disabled={isLoading && professionalStats.length === 0}
                  className={`${fieldClass} flex-1 min-w-0`}
                >
                  <option value="">Todas las operarias</option>
                  {professionalStats.map(({ id, name, completedCount, commission }) => (
                    <option key={id} value={id}>
                      {name}
                      {completedCount > 0 ? ` — ${completedCount} completado${completedCount !== 1 ? "s" : ""}` : ""}
                      {commission > 0 ? `  (${moneyFormatter.format(commission)})` : ""}
                    </option>
                  ))}
                </select>
                {selectedProfessionalId !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedProfessionalId(null)}
                    title="Ver todas"
                    className="flex shrink-0 items-center rounded-md border border-[var(--ui-border-strong)] bg-white p-2 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <select
                value={selectedProfessionalId ?? ""}
                onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                className={`${fieldClass} mt-1`}
              >
                <option value="">Todas</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
            )}
          </div>

          {/* Desde */}
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>

          {/* Hasta */}
          <div>
            <label className="text-xs font-semibold text-[var(--ui-text-muted)]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
        </div>
      </SectionCard>

      {/* ── Pestaña: Comisiones ─────────────────────────────────────────── */}
      {activeTab === "comisiones" && (
        <CommissionPaymentsTab
          professionals={professionals}
          tickets={filteredTickets}
          fromDate={fromDate}
          toDate={toDate}
          selectedProfessionalId={selectedProfessionalId}
          onStatsChange={handleCommissionStatsChange}
        />
      )}

      {/* ── Contenido de pestaña tickets ─────────────────────────────────── */}
      {activeTab === "tickets" && (
        <>
      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total tickets" value={filteredTickets.length} tone="slate" />
        <StatCard label="Completados" value={completedTickets.length} tone="emerald" />
        <StatCard
          label="En curso"
          value={filteredTickets.filter((t) => t.status === "in_service" || t.status === "pending").length}
          tone="amber"
        />
        <StatCard label="Ingresos (completados)" value={moneyFormatter.format(totalRevenue)} tone="emerald" />
        <StatCard label="Comisiones" value={moneyFormatter.format(totalCommission)} tone="blue" />
      </div>

      {/* ── Tabla de tickets ─────────────────────────────────────────────── */}
      <SectionCard bodyClassName="!p-0">
        {error ? <div className="border-b border-[var(--ui-border)] p-4 text-sm text-rose-600">{error}</div> : null}

        <DataTable
          data={filteredTickets}
          columns={columns}
          loading={isLoading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={25}
          tableMinWidth="min-w-[1280px]"
          rowClassName={(t) => (t.pagado ? PAID_ROW_CLASS : undefined)}
        />
      </SectionCard>
        </>
      )}

      {/* ── Diálogo: confirmar pago del lote ─────────────────────────────── */}
      <GenericModal
        isOpen={confirmPayOpen}
        onClose={() => { if (!paying) setConfirmPayOpen(false); }}
        title="Confirmar pago de comisiones"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmPayOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void handleConfirmPay()} disabled={paying || selectedTickets.length === 0}>
              {paying ? "Guardando…" : "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--ui-text)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[var(--ui-border)] p-2">
              <p className="text-[11px] text-[var(--ui-text-muted)]">Tickets</p>
              <p className="text-lg font-bold">{selectedTickets.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--ui-border)] p-2">
              <p className="text-[11px] text-[var(--ui-text-muted)]">Operarias</p>
              <p className="text-lg font-bold">{selectedSummary.byPro.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-accent-soft)] p-2">
              <p className="text-[11px] text-[var(--ui-text-muted)]">Total</p>
              <p className="text-lg font-bold text-[var(--ui-accent)]">{moneyFormatter.format(selectedSummary.total)}</p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--ui-border)] rounded-lg border border-[var(--ui-border)]">
            {selectedSummary.byPro.map(([name, { count, total }]) => (
              <li key={name} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="font-medium">{name} · {count} ticket{count !== 1 ? "s" : ""}</span>
                <span className="tabular-nums font-semibold">{moneyFormatter.format(total)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--ui-text-muted)]">
            Se guarda todo junto o nada. Se registrará un pago por operaria en "Comisiones y pagos".
          </p>
        </div>
      </GenericModal>

      {/* ── Diálogo: anular el pago de un ticket ──────────────────────────── */}
      <GenericModal
        isOpen={voidTarget !== null}
        onClose={() => { if (!voiding) setVoidTarget(null); }}
        title="Anular pago de comisión"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setVoidTarget(null)} disabled={voiding}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleConfirmVoid()} disabled={voiding}>
              {voiding ? "Anulando…" : "Anular pago"}
            </Button>
          </>
        }
      >
        {voidTarget && (
          <div className="space-y-3 text-sm text-[var(--ui-text)]">
            <p>
              El ticket <strong>{voidTarget.ticket_code ?? `#${voidTarget.id}`}</strong> de{" "}
              <strong>{voidTarget.professional_name ?? "sin operaria"}</strong> volverá a quedar pendiente y se
              descontará{" "}
              <strong>{moneyFormatter.format(voidTarget.pagado_monto ?? getTicketCommission(voidTarget))}</strong>{" "}
              de su pago en "Comisiones y pagos".
            </p>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--ui-text-muted)]">Motivo (opcional)</span>
              <input
                type="text"
                value={voidMotivo}
                maxLength={300}
                onChange={(e) => setVoidMotivo(e.target.value)}
                className={`${fieldClass} mt-1`}
                placeholder="Ej. se marcó por error"
              />
            </label>
          </div>
        )}
      </GenericModal>
    </Layout>
  );
}
