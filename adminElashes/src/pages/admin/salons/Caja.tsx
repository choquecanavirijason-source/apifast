import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Banknote, DoorOpen, Download, Eye, History, ListChecks, Plus, Save, Trash2 } from "lucide-react";
import Layout from "@/components/common/layout";
import { Button, SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableAction, type DataTableColumn } from "@/components/common/table/DataTable";
import GenericModal from "@/components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ExpenseService, type ExpenseOut } from "@/core/services/expense/expense.service";
import {
  CashSessionService,
  type CashSessionDetail,
  type CashSessionOut,
} from "@/core/services/cash-session/cash-session.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";
import { generateTablePdf } from "@/core/utils/generateTablePdf";
import variables from "@/core/config/variables";

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
  mixed: "Mixto",
};

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35";

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

const dateTimeFmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" }) : "—";

// ─── Modal: detalle de una sesión de caja ────────────────────────────────────

function SessionDetailModal({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<CashSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    CashSessionService.getDetail(sessionId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) toast.error("No se pudo cargar el detalle de la sesión."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <GenericModal isOpen onClose={onClose} title="Detalle de la sesión de caja" size="lg">
      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : !detail ? (
        <p className="text-sm text-slate-500">No se pudo cargar el detalle.</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#605e5c]">Ingresos por método</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded-lg border border-[#edebe9] p-2 text-center">
                <p className="text-[10px] uppercase text-[#605e5c]">Efectivo</p>
                <p className="text-sm font-semibold tabular-nums">{moneyFormatter.format(detail.income_by_method.efectivo)}</p>
              </div>
              <div className="rounded-lg border border-[#edebe9] p-2 text-center">
                <p className="text-[10px] uppercase text-[#605e5c]">Tarjeta</p>
                <p className="text-sm font-semibold tabular-nums">{moneyFormatter.format(detail.income_by_method.tarjeta)}</p>
              </div>
              <div className="rounded-lg border border-[#edebe9] p-2 text-center">
                <p className="text-[10px] uppercase text-[#605e5c]">Transferencia</p>
                <p className="text-sm font-semibold tabular-nums">{moneyFormatter.format(detail.income_by_method.transferencia)}</p>
              </div>
              <div className="rounded-lg border border-[#edebe9] p-2 text-center">
                <p className="text-[10px] uppercase text-[#605e5c]">QR</p>
                <p className="text-sm font-semibold tabular-nums">{moneyFormatter.format(detail.income_by_method.qr)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                <p className="text-[10px] uppercase text-emerald-700">Total</p>
                <p className="text-sm font-bold tabular-nums text-emerald-800">{moneyFormatter.format(detail.income_by_method.total)}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#605e5c]">
              Pagos ({detail.payments.length})
            </h4>
            {detail.payments.length === 0 ? (
              <p className="text-xs text-slate-400">Sin pagos en esta sesión.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[#edebe9]">
                <table className="w-full text-xs">
                  <thead className="bg-[#faf9f8]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-[#605e5c]">Cliente</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-[#605e5c]">Método</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-[#605e5c]">Hora</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-[#605e5c]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p) => (
                      <tr key={p.id} className="border-t border-[#edebe9]">
                        <td className="px-2 py-1.5">{p.client_name ?? "—"}</td>
                        <td className="px-2 py-1.5">{METHOD_LABELS[p.method] ?? p.method}</td>
                        <td className="px-2 py-1.5">{p.paid_at ? dateTimeFmt(p.paid_at) : "—"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{moneyFormatter.format(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#605e5c]">
              Gastos ({detail.expenses.length})
            </h4>
            {detail.expenses.length === 0 ? (
              <p className="text-xs text-slate-400">Sin gastos en esta sesión.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#edebe9]">
                <table className="w-full text-xs">
                  <thead className="bg-[#faf9f8]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-[#605e5c]">Descripción</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-[#605e5c]">Hora</th>
                      <th className="px-2 py-1.5 text-right font-semibold text-[#605e5c]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.expenses.map((e) => (
                      <tr key={e.id} className="border-t border-[#edebe9]">
                        <td className="px-2 py-1.5">{e.description}</td>
                        <td className="px-2 py-1.5">{e.created_at ? dateTimeFmt(e.created_at) : "—"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-rose-700">
                          {moneyFormatter.format(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </GenericModal>
  );
}

// ─── Pestaña: Apertura y Cierre ───────────────────────────────────────────────

function AperturaCierreTab() {
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [session, setSession] = useState<CashSessionOut | null>(null);
  const [history, setHistory] = useState<CashSessionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [nextFundAmount, setNextFundAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastClosed, setLastClosed] = useState<CashSessionOut | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [liveDetail, setLiveDetail] = useState<CashSessionDetail | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) {
      setSession(null);
      return;
    }
    setLoading(true);
    try {
      const data = await CashSessionService.getCurrent(branchId);
      setSession(data);
    } catch {
      toast.error("No se pudo consultar el estado de la caja.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadHistory = useCallback(async () => {
    if (!branchId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const data = await CashSessionService.list({
        branch_id: branchId,
        from_date: historyFromDate || undefined,
        to_date: historyToDate || undefined,
      });
      setHistory(data);
    } catch {
      toast.error("No se pudo cargar el historial de la caja.");
    } finally {
      setHistoryLoading(false);
    }
  }, [branchId, historyFromDate, historyToDate]);

  const loadLiveDetail = useCallback(async (sessionId: number) => {
    setLiveLoading(true);
    try {
      const data = await CashSessionService.getDetail(sessionId);
      setLiveDetail(data);
    } catch {
      // silencioso — no interrumpir con un toast cada vez que el refresco automático falla
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Mientras la caja esté abierta, el "esperado" se recalcula solo cada 20s
  // (además de al abrir la pantalla) — así se puede hacer un cuadre parcial
  // sin tener que cerrar la caja para enterarse si sobra o falta.
  useEffect(() => {
    if (!session || session.status !== "open") {
      setLiveDetail(null);
      return;
    }
    void loadLiveDetail(session.id);
    const interval = setInterval(() => void loadLiveDetail(session.id), 20000);
    return () => clearInterval(interval);
  }, [session, loadLiveDetail]);

  useEffect(() => {
    const handleChange = () => setBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const handleOpen = async () => {
    if (!branchId) {
      toast.warning("Elegí una sucursal en el selector de arriba.");
      return;
    }
    const amt = parseFloat(openingAmount);
    if (Number.isNaN(amt) || amt < 0) {
      toast.warning("Cargá el monto inicial de la caja.");
      return;
    }
    setSubmitting(true);
    try {
      await CashSessionService.open({ branch_id: branchId, opening_amount: amt, notes: openNotes.trim() || undefined });
      toast.success("Caja abierta.");
      setOpeningAmount("");
      setOpenNotes("");
      setLastClosed(null);
      setIsOpenModalOpen(false);
      void load();
      void loadHistory();
    } catch {
      toast.error("No se pudo abrir la caja — puede que ya haya una abierta.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!session) return;
    const counted = parseFloat(countedAmount);
    if (!countedAmount.trim() || Number.isNaN(counted) || counted < 0) {
      toast.warning("Contá el efectivo de la caja y cargá el monto antes de cerrar.");
      return;
    }
    const fund = parseFloat(nextFundAmount);
    if (!nextFundAmount.trim() || Number.isNaN(fund) || fund < 0) {
      toast.warning("Indicá cuánto dejás en la caja para el siguiente turno.");
      return;
    }
    if (fund > counted) {
      toast.warning("El fondo para el siguiente turno no puede ser mayor al monto contado.");
      return;
    }
    setIsCloseConfirmOpen(true);
  };

  const performClose = async () => {
    if (!session) return;
    const counted = parseFloat(countedAmount);
    const fundAmt = parseFloat(nextFundAmount);
    setSubmitting(true);
    try {
      const closed = await CashSessionService.close(session.id, counted, closeNotes.trim() || undefined, fundAmt);
      toast.success("Caja cerrada.");
      setCloseNotes("");
      setCountedAmount("");
      setNextFundAmount("");
      setLastClosed(closed);
      void load();
      void loadHistory();
    } catch {
      toast.error("No se pudo cerrar la caja.");
    } finally {
      setSubmitting(false);
      setIsCloseConfirmOpen(false);
    }
  };

  const historyColumns: DataTableColumn<CashSessionOut>[] = [
    {
      key: "status",
      header: "Estado",
      sortable: true,
      render: (s) => (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            s.status === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {s.status === "open" ? "Abierta" : "Cerrada"}
        </span>
      ),
    },
    {
      key: "opened_by_name",
      header: "Abierta por",
      sortable: true,
      render: (s) => <span className="text-xs text-[#323130]">{s.opened_by_name ?? "—"}</span>,
    },
    {
      key: "opened_at",
      header: "Apertura",
      sortable: true,
      getValue: (s) => s.opened_at,
      render: (s) => <span className="text-xs text-[#605e5c]">{dateTimeFmt(s.opened_at)}</span>,
    },
    {
      key: "opening_amount",
      header: "Monto inicial",
      sortable: true,
      getValue: (s) => s.opening_amount ?? 0,
      render: (s) => (
        <span className="text-xs font-semibold tabular-nums text-[#323130]">
          {moneyFormatter.format(s.opening_amount ?? 0)}
        </span>
      ),
    },
    {
      key: "closed_by_name",
      header: "Cerrada por",
      render: (s) => <span className="text-xs text-[#323130]">{s.closed_by_name ?? "—"}</span>,
    },
    {
      key: "closed_at",
      header: "Cierre",
      sortable: true,
      getValue: (s) => s.closed_at ?? "",
      render: (s) => <span className="text-xs text-[#605e5c]">{s.closed_at ? dateTimeFmt(s.closed_at) : "—"}</span>,
    },
    {
      key: "grand_total",
      header: "Total vendido",
      sortable: true,
      getValue: (s) => s.grand_total,
      render: (s) => (
        <span className="text-xs font-semibold tabular-nums text-emerald-700">
          {s.status === "closed" ? moneyFormatter.format(s.grand_total) : "—"}
        </span>
      ),
    },
    {
      key: "expected_cash",
      header: "Esperado",
      sortable: true,
      getValue: (s) => s.expected_cash ?? 0,
      render: (s) => (
        <span className="text-xs tabular-nums text-[#323130]">
          {s.expected_cash !== null ? moneyFormatter.format(s.expected_cash) : "—"}
        </span>
      ),
    },
    {
      key: "counted_amount",
      header: "Contado",
      sortable: true,
      getValue: (s) => s.counted_amount ?? 0,
      render: (s) => (
        <span className="text-xs tabular-nums text-[#323130]">
          {s.counted_amount !== null ? moneyFormatter.format(s.counted_amount) : "—"}
        </span>
      ),
    },
    {
      key: "difference",
      header: "Sobra/Falta",
      sortable: true,
      getValue: (s) => s.difference ?? 0,
      render: (s) => {
        if (s.difference === null) return <span className="text-xs text-[#a19f9d]">—</span>;
        const color = s.difference === 0 ? "text-emerald-700" : s.difference > 0 ? "text-blue-700" : "text-rose-700";
        const sign = s.difference > 0 ? "+" : s.difference < 0 ? "−" : "";
        return (
          <span className={`text-xs font-semibold tabular-nums ${color}`}>
            {sign}{moneyFormatter.format(Math.abs(s.difference))}
          </span>
        );
      },
    },
    {
      key: "next_fund_amount",
      header: "Fondo siguiente turno",
      sortable: true,
      getValue: (s) => s.next_fund_amount ?? 0,
      render: (s) => (
        <span className="text-xs font-semibold tabular-nums text-emerald-700">
          {s.next_fund_amount != null ? moneyFormatter.format(s.next_fund_amount) : "—"}
        </span>
      ),
    },
  ];

  const historyActions: DataTableAction<CashSessionOut>[] = [
    {
      label: "Ver detalle",
      icon: <Eye className="h-4 w-4" />,
      onClick: (s) => setDetailSessionId(s.id),
    },
  ];

  const handleDownloadHistoryPdf = () => {
    const branchName = history[0]?.branch_name ?? session?.branch_name ?? "—";
    const rangeLabel = historyFromDate || historyToDate
      ? `${historyFromDate ? new Date(historyFromDate).toLocaleDateString("es-BO") : "inicio"} — ${historyToDate ? new Date(historyToDate).toLocaleDateString("es-BO") : "hoy"}`
      : "Todo el período";
    void generateTablePdf({
      title: "Historial de apertura y cierre",
      subtitle: `${branchName} · ${rangeLabel}`,
      filename: "historial-apertura-cierre",
      orientation: "landscape",
      columns: [
        { header: "Estado", key: "estado" },
        { header: "Abierta por", key: "opened_by_name" },
        { header: "Apertura", key: "opened_at" },
        { header: "Monto inicial", key: "opening_amount" },
        { header: "Cerrada por", key: "closed_by_name" },
        { header: "Cierre", key: "closed_at" },
        { header: "Total vendido", key: "grand_total" },
        { header: "Esperado", key: "expected_cash" },
        { header: "Contado", key: "counted_amount" },
        { header: "Sobra/Falta", key: "difference" },
        { header: "Fondo siguiente turno", key: "next_fund_amount" },
      ],
      rows: history.map((s) => ({
        estado: s.status === "open" ? "Abierta" : "Cerrada",
        opened_by_name: s.opened_by_name ?? "—",
        opened_at: dateTimeFmt(s.opened_at),
        opening_amount: moneyFormatter.format(s.opening_amount ?? 0),
        closed_by_name: s.closed_by_name ?? "—",
        closed_at: s.closed_at ? dateTimeFmt(s.closed_at) : "—",
        grand_total: s.status === "closed" ? moneyFormatter.format(s.grand_total) : "—",
        expected_cash: s.expected_cash !== null ? moneyFormatter.format(s.expected_cash) : "—",
        counted_amount: s.counted_amount !== null ? moneyFormatter.format(s.counted_amount) : "—",
        difference: s.difference !== null ? moneyFormatter.format(s.difference) : "—",
        next_fund_amount: s.next_fund_amount != null ? moneyFormatter.format(s.next_fund_amount) : "—",
      })),
    });
  };

  const historyTable = branchId ? (
    <SectionCard title="Historial de apertura y cierre" bodyClassName="!p-0">
      <div className="grid gap-3 border-b border-[#edebe9] p-3 sm:grid-cols-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Desde</label>
          <input
            type="date"
            value={historyFromDate}
            onChange={(e) => setHistoryFromDate(e.target.value)}
            className={`${fieldClass} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Hasta</label>
          <input
            type="date"
            value={historyToDate}
            onChange={(e) => setHistoryToDate(e.target.value)}
            className={`${fieldClass} mt-1`}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={() => void loadHistory()} className="w-full">Filtrar</Button>
        </div>
        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={handleDownloadHistoryPdf}
            disabled={history.length === 0}
            leftIcon={<Download className="h-3.5 w-3.5" />}
            className="w-full"
          >
            PDF
          </Button>
        </div>
      </div>
      <DataTable
        data={history}
        columns={historyColumns}
        actions={historyActions}
        loading={historyLoading}
        enableGlobalSearch={false}
        enableColumnFilters={false}
        defaultLimit={10}
      />
      {detailSessionId !== null && (
        <SessionDetailModal sessionId={detailSessionId} onClose={() => setDetailSessionId(null)} />
      )}
    </SectionCard>
  ) : null;

  if (!branchId) {
    return (
      <SectionCard>
        <p className="text-sm text-slate-500">Elegí una sucursal en el selector de arriba para ver el estado de su caja.</p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard>
        <p className="text-sm text-slate-500">Cargando…</p>
      </SectionCard>
    );
  }

  if (session) {
    return (
      <>
      <SectionCard
        title={`Caja abierta — ${session.branch_name}`}
        actions={
          <Button
            variant="danger"
            onClick={handleClose}
            disabled={submitting || !countedAmount.trim() || !nextFundAmount.trim()}
            leftIcon={<DoorOpen className="h-4 w-4" />}
          >
            {submitting ? "Cerrando…" : "Cerrar caja"}
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Abierta por</p>
            <p className="text-sm font-medium text-[#323130]">{session.opened_by_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fecha y hora</p>
            <p className="text-sm font-medium text-[#323130]">{dateTimeFmt(session.opened_at)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Monto inicial</p>
            <p className="text-sm font-semibold tabular-nums text-emerald-700">
              {moneyFormatter.format(session.opening_amount ?? 0)}
            </p>
          </div>
        </div>
        {session.notes && <p className="mt-3 text-xs text-[#605e5c]">Nota: {session.notes}</p>}

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Esperado en caja (solo efectivo)</p>
              <p className="text-lg font-bold tabular-nums text-blue-900">
                {liveDetail ? moneyFormatter.format(liveDetail.expected_cash) : "…"}
              </p>
              {liveDetail && (
                <span className="text-xs text-blue-700">
                  inicial {moneyFormatter.format(session.opening_amount ?? 0)} + efectivo {moneyFormatter.format(liveDetail.cash_sales)} − gastos {moneyFormatter.format(liveDetail.cash_expenses)}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total vendido (todos los métodos)</p>
              <p className="text-lg font-bold tabular-nums text-emerald-800">
                {liveDetail ? moneyFormatter.format(liveDetail.income_by_method.total) : "…"}
              </p>
              {liveDetail && (
                <span className="text-xs text-emerald-700">
                  efectivo {moneyFormatter.format(liveDetail.income_by_method.efectivo)} · tarjeta {moneyFormatter.format(liveDetail.income_by_method.tarjeta)} · transferencia {moneyFormatter.format(liveDetail.income_by_method.transferencia)} · QR {moneyFormatter.format(liveDetail.income_by_method.qr)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadLiveDetail(session.id)}
              disabled={liveLoading}
              className="ml-auto text-xs font-semibold text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
            >
              {liveLoading ? "Actualizando…" : "Actualizar ahora"}
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-[#edebe9] pt-4">
          <p className="mb-3 text-xs text-[#605e5c]">
            Al cerrar, contá el efectivo físico de la caja y cargalo abajo — el sistema compara contra lo esperado
            (monto inicial + ventas en efectivo − gastos en efectivo) y muestra si sobra o falta.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Monto contado <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={countedAmount}
                onChange={(e) => setCountedAmount(e.target.value)}
                placeholder="0.00"
                className={`${fieldClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                Fondo para el siguiente turno <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                max={countedAmount || undefined}
                step="0.01"
                required
                value={nextFundAmount}
                onChange={(e) => setNextFundAmount(e.target.value)}
                placeholder="0.00"
                className={`${fieldClass} mt-1`}
              />
              <p className="mt-1 text-[11px] text-[#605e5c]">
                Cuánto del efectivo contado se deja en el cajón como cambio para quien abra la próxima caja.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Nota de cierre (opcional)</label>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Ej. faltante justificado, novedades del turno..."
                className={`${fieldClass} mt-1`}
              />
            </div>
          </div>
        </div>
      </SectionCard>
      {historyTable}
      <ConfirmDialog
        isOpen={isCloseConfirmOpen}
        title="Cerrar caja"
        message="¿Cerrar la caja de esta sucursal? No vas a poder registrar más ventas ahí hasta que se vuelva a abrir."
        confirmText="Cerrar caja"
        variant="danger"
        isProcessing={submitting}
        onConfirm={() => void performClose()}
        onCancel={() => setIsCloseConfirmOpen(false)}
      />
      </>
    );
  }

  // Si la pantalla se recargó (o abre otra cajera) `lastClosed` local está
  // vacío — usamos el último cierre del historial (ya viene ordenado por
  // id descendente) para no perder el fondo dejado para este turno.
  const lastClosedOrFromHistory = lastClosed ?? history.find((s) => s.status === "closed") ?? null;

  return (
    <>
    {lastClosedOrFromHistory && lastClosedOrFromHistory.expected_cash !== null && (() => {
      const lastClosed = lastClosedOrFromHistory;
      return (
      <SectionCard title="Arqueo del último cierre">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Esperado en caja</p>
            <p className="text-sm font-semibold tabular-nums text-[#323130]">
              {moneyFormatter.format(lastClosed.expected_cash ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Contado</p>
            <p className="text-sm font-semibold tabular-nums text-[#323130]">
              {lastClosed.counted_amount !== null ? moneyFormatter.format(lastClosed.counted_amount) : "— no se contó —"}
            </p>
          </div>
          {lastClosed.difference !== null && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">
                {lastClosed.difference === 0 ? "Diferencia" : lastClosed.difference > 0 ? "Sobra" : "Falta"}
              </p>
              <p
                className={`text-sm font-bold tabular-nums ${
                  lastClosed.difference === 0
                    ? "text-emerald-700"
                    : lastClosed.difference > 0
                      ? "text-blue-700"
                      : "text-rose-700"
                }`}
              >
                {moneyFormatter.format(Math.abs(lastClosed.difference))}
              </p>
            </div>
          )}
          {lastClosed.next_fund_amount != null && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fondo dejado para el siguiente turno</p>
              <p className="text-sm font-bold tabular-nums text-emerald-700">
                {moneyFormatter.format(lastClosed.next_fund_amount)}
              </p>
            </div>
          )}
        </div>
      </SectionCard>
      );
    })()}
    <SectionCard
      title="Abrir caja"
      bodyClassName="!hidden"
      actions={
        <Button
          size="lg"
          onClick={() => {
            if (lastClosedOrFromHistory?.next_fund_amount) {
              setOpeningAmount(String(lastClosedOrFromHistory.next_fund_amount));
            }
            setIsOpenModalOpen(true);
          }}
          leftIcon={<DoorOpen className="h-4 w-4" />}
        >
          Abrir caja
        </Button>
      }
    >
      {null}
    </SectionCard>
    {historyTable}
    <GenericModal
      isOpen={isOpenModalOpen}
      onClose={() => setIsOpenModalOpen(false)}
      title="Abrir caja"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => setIsOpenModalOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleOpen()} disabled={submitting} leftIcon={<DoorOpen className="h-4 w-4" />}>
            {submitting ? "Abriendo…" : "Abrir caja"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Monto inicial</label>
          <input
            type="number"
            min="0"
            step="0.01"
            autoFocus
            value={openingAmount}
            onChange={(e) => setOpeningAmount(e.target.value)}
            placeholder="0.00"
            className={`${fieldClass} mt-1`}
          />
          {lastClosedOrFromHistory?.next_fund_amount != null
            && openingAmount === String(lastClosedOrFromHistory.next_fund_amount) && (
            <p className="mt-1 text-[11px] text-[#605e5c]">
              Sugerido a partir del fondo dejado en el cierre anterior — podés cambiarlo.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Nota (opcional)</label>
          <input
            type="text"
            value={openNotes}
            onChange={(e) => setOpenNotes(e.target.value)}
            placeholder="Ej. turno mañana"
            className={`${fieldClass} mt-1`}
          />
        </div>
      </div>
    </GenericModal>
    </>
  );
}

// ─── Pestaña: Nuevo Gasto ─────────────────────────────────────────────────────

interface DraftExpense {
  id: string;
  expense_date: string;
  amount: number;
  description: string;
  photoFile: File | null;
  photoName: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

function NuevoGastoTab() {
  const [draft, setDraft] = useState<DraftExpense[]>([]);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const total = draft.reduce((s, d) => s + d.amount, 0);

  const addDraft = () => {
    const amt = parseFloat(amount);
    if (!date || Number.isNaN(amt) || amt <= 0 || !description.trim()) {
      toast.warning("Completá fecha, monto y descripción.");
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        expense_date: date,
        amount: amt,
        description: description.trim(),
        photoFile,
        photoName: photoFile?.name ?? null,
      },
    ]);
    setAmount("");
    setDescription("");
    setPhotoFile(null);
  };

  const removeDraft = (id: string) => {
    setDraft((prev) => prev.filter((d) => d.id !== id));
  };

  const clearAll = () => setDraft([]);

  const saveAll = async () => {
    if (draft.length === 0) return;
    const branchId = getSelectedBranchId();
    if (!branchId) {
      toast.warning("Elegí una sucursal en el selector de arriba antes de guardar.");
      return;
    }
    setSaving(true);
    // Cada gasto se guarda por separado — si uno falla (ej. no se pudo subir
    // la foto), no debe tumbar a los demás; el que falló se queda en la
    // lista para reintentar, en vez de perderse en silencio.
    const failed: DraftExpense[] = [];
    let savedCount = 0;
    for (const item of draft) {
      try {
        let photo_url: string | null = null;
        if (item.photoFile) {
          photo_url = await ExpenseService.uploadPhoto(item.photoFile);
        }
        await ExpenseService.create({
          branch_id: branchId,
          amount: item.amount,
          description: item.description,
          expense_date: item.expense_date,
          photo_url,
        });
        savedCount++;
      } catch {
        failed.push(item);
      }
    }
    setDraft(failed);
    setSaving(false);

    if (savedCount > 0) {
      toast.success(`${savedCount} gasto${savedCount !== 1 ? "s" : ""} guardado${savedCount !== 1 ? "s" : ""}.`);
    }
    if (failed.length > 0) {
      toast.error(
        `${failed.length} gasto${failed.length !== 1 ? "s" : ""} no se pudo${failed.length !== 1 ? "ieron" : ""} guardar — revisá tus permisos y volvé a intentar.`
      );
    }
  };

  const handleDownloadPdf = () => {
    void generateTablePdf({
      title: "Caja — Registro de gastos",
      subtitle: `Total: ${moneyFormatter.format(total)} · ${draft.length} gasto${draft.length !== 1 ? "s" : ""}`,
      filename: "registro-de-gastos",
      columns: [
        { header: "Fecha", key: "expense_date" },
        { header: "Monto", key: "amount" },
        { header: "Descripción", key: "description" },
        { header: "Foto", key: "photo" },
      ],
      rows: draft.map((d) => ({
        expense_date: d.expense_date,
        amount: moneyFormatter.format(d.amount),
        description: d.description,
        photo: d.photoName ?? "—",
      })),
    });
  };

  const columns: DataTableColumn<DraftExpense>[] = [
    {
      key: "expense_date",
      header: "Fecha",
      sortable: true,
      render: (d) => <span className="text-xs text-[#323130]">{d.expense_date}</span>,
    },
    {
      key: "amount",
      header: "Monto",
      sortable: true,
      getValue: (d) => d.amount,
      render: (d) => (
        <span className="text-xs font-semibold tabular-nums text-[#323130]">
          {moneyFormatter.format(d.amount)}
        </span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      sortable: true,
      render: (d) => <span className="text-xs text-[#323130]">{d.description}</span>,
    },
    {
      key: "photo",
      header: "Foto",
      render: (d) => <span className="text-xs text-[#605e5c]">{d.photoName ?? "—"}</span>,
    },
  ];

  const actions: DataTableAction<DraftExpense>[] = [
    {
      label: "Quitar",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (d) => removeDraft(d.id),
      variant: "danger",
    },
  ];

  return (
    <SectionCard title="Registro de gastos">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} mt-1`} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Monto</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${fieldClass} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Foto (opcional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className={`${fieldClass} mt-1 py-1.5`}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción del gasto"
            className={`${fieldClass} mt-1`}
          />
        </div>
      </div>

      <div className="mt-4">
        <Button onClick={addDraft} leftIcon={<Plus className="h-4 w-4" />}>
          Agregar
        </Button>
      </div>

      <div className="mt-5">
        <DataTable
          data={draft}
          columns={columns}
          actions={actions}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={10}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-[#605e5c]">
          Total de gastos: {draft.length}
          {draft.length > 0 ? ` · ${moneyFormatter.format(total)}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={draft.length === 0}
            leftIcon={<Download className="h-4 w-4" />}
          >
            PDF
          </Button>
          <Button variant="secondary" onClick={clearAll} disabled={draft.length === 0 || saving}>
            Limpiar todo
          </Button>
          <Button onClick={() => void saveAll()} disabled={draft.length === 0 || saving} leftIcon={<Save className="h-4 w-4" />}>
            {saving ? "Guardando…" : "Guardar gastos"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Pestaña: Historial de Gastos ─────────────────────────────────────────────

function HistorialGastosTab() {
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [expenses, setExpenses] = useState<ExpenseOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deletingExpense, setDeletingExpense] = useState<ExpenseOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ExpenseService.list({
        branch_id: branchId ?? undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setExpenses(data);
    } catch {
      toast.error("No se pudo cargar el historial de gastos.");
    } finally {
      setLoading(false);
    }
  }, [branchId, fromDate, toDate]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handleChange = () => setBranchId(getSelectedBranchId());
    const handleStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const performDelete = async () => {
    if (!deletingExpense) return;
    setDeleting(true);
    try {
      await ExpenseService.remove(deletingExpense.id);
      toast.success("Gasto eliminado.");
      void load();
    } catch {
      toast.error("No se pudo eliminar el gasto.");
    } finally {
      setDeleting(false);
      setDeletingExpense(null);
    }
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleDownloadPdf = () => {
    void generateTablePdf({
      title: "Historial de gastos",
      subtitle: `Total: ${moneyFormatter.format(total)} · ${expenses.length} gasto${expenses.length !== 1 ? "s" : ""}`,
      filename: "historial-de-gastos",
      columns: [
        { header: "Fecha", key: "expense_date" },
        { header: "Sucursal", key: "branch_name" },
        { header: "Monto", key: "amount" },
        { header: "Descripción", key: "description" },
        { header: "Registrado por", key: "created_by_name" },
      ],
      rows: expenses.map((e) => ({
        expense_date: e.expense_date,
        branch_name: e.branch_name,
        amount: moneyFormatter.format(e.amount),
        description: e.description,
        created_by_name: e.created_by_name ?? "—",
      })),
    });
  };

  const columns: DataTableColumn<ExpenseOut>[] = [
    {
      key: "expense_date",
      header: "Fecha",
      sortable: true,
      render: (e) => <span className="text-xs text-[#323130]">{e.expense_date}</span>,
    },
    {
      key: "branch_name",
      header: "Sucursal",
      sortable: true,
      render: (e) => <span className="text-xs text-[#605e5c]">{e.branch_name}</span>,
    },
    {
      key: "amount",
      header: "Monto",
      sortable: true,
      getValue: (e) => e.amount,
      render: (e) => (
        <span className="text-xs font-semibold tabular-nums text-rose-700">{moneyFormatter.format(e.amount)}</span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      sortable: true,
      render: (e) => <span className="text-xs text-[#323130]">{e.description}</span>,
    },
    {
      key: "photo_url",
      header: "Foto",
      render: (e) =>
        e.photo_url ? (
          <a
            href={`${variables.apiUrl}${e.photo_url}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-[#0078d4] underline"
          >
            Ver foto
          </a>
        ) : (
          <span className="text-xs text-[#a19f9d]">—</span>
        ),
    },
    {
      key: "created_by_name",
      header: "Registrado por",
      sortable: true,
      render: (e) => <span className="text-xs text-[#605e5c]">{e.created_by_name ?? "—"}</span>,
    },
  ];

  const actions: DataTableAction<ExpenseOut>[] = [
    {
      label: "Eliminar",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (e) => setDeletingExpense(e),
      variant: "danger",
    },
  ];

  return (
    <>
      <SectionCard bodyClassName="!p-4">
        <div className="grid gap-3 rounded-sm border border-[#d2d0ce] bg-[#faf9f8] p-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={() => void load()} className="w-full">
              Actualizar
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={expenses.length === 0}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              PDF
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Historial de gastos"
        subtitle={`Total: ${moneyFormatter.format(total)} · ${expenses.length} gasto${expenses.length !== 1 ? "s" : ""}`}
        bodyClassName="!p-0"
      >
        <DataTable
          data={expenses}
          columns={columns}
          actions={actions}
          loading={loading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          defaultLimit={15}
        />
      </SectionCard>
      <ConfirmDialog
        isOpen={deletingExpense !== null}
        title="Eliminar gasto"
        message={
          deletingExpense
            ? `¿Eliminar el gasto "${deletingExpense.description}" (${moneyFormatter.format(deletingExpense.amount)})?`
            : ""
        }
        confirmText="Eliminar"
        variant="danger"
        isProcessing={deleting}
        onConfirm={() => void performDelete()}
        onCancel={() => setDeletingExpense(null)}
      />
    </>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function Caja() {
  const [activeTab, setActiveTab] = useState<"apertura" | "gastos" | "historial">("apertura");

  return (
    <Layout title="Caja" subtitle="Apertura/cierre y registro de gastos de la sucursal activa." variant="cards">
      <div className="flex gap-1 rounded-xl border border-[#edebe9] bg-[#f3f2f1] p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("apertura")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "apertura"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          Apertura y Cierre
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gastos")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "gastos"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <Banknote className="h-3.5 w-3.5" />
          Nuevo Gasto
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "historial"
              ? "bg-white text-[#323130] shadow-sm ring-1 ring-black/5"
              : "text-[#605e5c] hover:bg-white/50"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Historial de Gastos
        </button>
      </div>

      {activeTab === "apertura" && <AperturaCierreTab />}
      {activeTab === "gastos" && <NuevoGastoTab />}
      {activeTab === "historial" && <HistorialGastosTab />}
    </Layout>
  );
}
