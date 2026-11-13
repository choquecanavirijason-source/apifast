import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Banknote, CreditCard, QrCode, Landmark } from "lucide-react";
import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { PosSaleService, type PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";

type Method = "cash" | "card" | "transfer" | "qr";

const METHODS: { id: Method; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "card", label: "Tarjeta", icon: CreditCard },
  { id: "qr", label: "QR", icon: QrCode },
  { id: "transfer", label: "Transferencia", icon: Landmark },
];

type CollectPaymentModalProps = {
  /** Ticket cuya venta reservada se cobra al pasarlo a servicio. null = cerrado. */
  ticket: TicketItem | null;
  /** Se cobró: continúa el pase a servicio. */
  onPaid: (ticket: TicketItem, sale: PosSaleItem) => void;
  onClose: () => void;
};

/** Cobro de la venta reservada de una cita de la agenda, justo antes de iniciar su atención. */
export default function CollectPaymentModal({ ticket, onPaid, onClose }: CollectPaymentModalProps) {
  const [sale, setSale] = useState<PosSaleItem | null>(null);
  const [loadError, setLoadError] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    setSale(null);
    setLoadError("");
    setMethod("cash");
    setCashReceived("");
    if (!ticket?.sale_id) return;
    let cancelled = false;
    PosSaleService.getById(ticket.sale_id)
      .then((data) => {
        if (!cancelled) setSale(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, "No se pudo cargar la venta."));
      });
    return () => {
      cancelled = true;
    };
  }, [ticket?.id, ticket?.sale_id]);

  const total = sale?.total ?? 0;
  const received = Number(cashReceived);
  const hasReceived = cashReceived.trim() !== "" && Number.isFinite(received);
  const change = useMemo(() => (hasReceived ? Math.max(0, received - total) : 0), [hasReceived, received, total]);
  const cashShort = method === "cash" && hasReceived && received < total;
  // En efectivo se debe ingresar lo que entregó la clienta, igual que en el POS.
  const cashMissing = method === "cash" && !hasReceived;

  const handlePay = async () => {
    if (!ticket || !sale) return;
    if (cashMissing) {
      toast.warning("Ingresa el monto recibido en efectivo.");
      return;
    }
    if (cashShort) {
      toast.warning(`El monto recibido no cubre el total (Bs ${total.toFixed(2)}).`);
      return;
    }
    setIsPaying(true);
    try {
      const paid = await PosSaleService.pay(sale.id, {
        payment_method: method,
        ...(method === "cash" ? { cash_received: received } : {}),
      });
      toast.success(`Cobro registrado (${paid.sale_code}).`);
      onPaid(ticket, paid);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo registrar el cobro."));
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <GenericModal
      isOpen={ticket !== null}
      onClose={() => {
        if (!isPaying) onClose();
      }}
      title="Cobrar antes de iniciar"
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPaying}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={() => void handlePay()} disabled={isPaying || !sale || cashMissing || cashShort}>
            {isPaying ? "Cobrando…" : "Cobrar e iniciar"}
          </Button>
        </div>
      }
    >
      {ticket && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface-muted)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--ui-text)]">{ticket.client_name}</p>
            <p className="text-xs text-[var(--ui-text-muted)]">
              {(ticket.service_names?.length ? ticket.service_names : [ticket.service_name]).filter(Boolean).join(" + ")}
              {sale ? ` · ${sale.sale_code}` : ""}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--ui-text)]">
              {sale ? `Bs ${total.toFixed(2)}` : loadError ? "—" : "Cargando…"}
            </p>
          </div>

          {loadError ? <p className="text-xs font-medium text-rose-600">{loadError}</p> : null}

          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--ui-text-muted)]">Método de pago</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                    method === id
                      ? "border-[#094732] bg-[#ecfdf5] text-[#094732]"
                      : "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {method === "cash" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[var(--ui-text-muted)]">
                Monto recibido <span className="text-rose-600">*</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Ingresa el monto"
                  className={`mt-1 h-9 w-full rounded-lg border bg-[var(--ui-input)] px-2.5 text-sm text-[var(--ui-text)] outline-none focus:ring-2 ${
                    cashShort
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20"
                      : "border-[var(--ui-border-strong)] focus:border-brand-secondary focus:ring-brand-secondary/20"
                  }`}
                />
              </label>
              <div className="text-xs font-medium text-[var(--ui-text-muted)]">
                Vuelto
                <p className="mt-1 flex h-9 items-center text-lg font-bold tabular-nums text-[var(--ui-text)]">
                  Bs {change.toFixed(2)}
                </p>
              </div>
              {cashShort ? (
                <p className="col-span-2 text-xs font-medium text-rose-600">El monto recibido no cubre el total.</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </GenericModal>
  );
}
