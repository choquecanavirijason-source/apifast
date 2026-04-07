import type { Dispatch, SetStateAction } from "react";
import type { IClient } from "../../../core/types/IClient";
import type { TicketItem } from "../../../core/services/agenda/agenda.service";
import type { PaymentItem } from "../../../core/services/payment/payment.service";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, InputField, SectionCard } from "../../../components/common/ui";

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "qr", label: "QR" },
];

interface ClientPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClient: IClient | null;
  isEnabledToday: (clientId: number) => boolean;
  paymentAmount: string;
  setPaymentAmount: Dispatch<SetStateAction<string>>;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  selectedTicketId: string;
  setSelectedTicketId: Dispatch<SetStateAction<string>>;
  isSubmittingPayment: boolean;
  isLoadingPayments: boolean;
  clientTickets: TicketItem[];
  clientPayments: PaymentItem[];
  onRegisterPayment: () => void | Promise<void>;
}

export default function ClientPaymentsModal({
  isOpen,
  onClose,
  currentClient,
  isEnabledToday,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  selectedTicketId,
  setSelectedTicketId,
  isSubmittingPayment,
  isLoadingPayments,
  clientTickets,
  clientPayments,
  onRegisterPayment,
}: ClientPaymentsModalProps) {
  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pagos de ${currentClient?.nombre || "cliente"}`}
      size="xl"
      contentClassName="w-[96vw] max-w-[1500px] max-h-[92vh] overflow-hidden flex flex-col"
      bodyClassName="flex-1 overflow-auto pr-1"
      footer={(
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.25fr]">
        <div className="space-y-4">
          <SectionCard className="!rounded-xl" bodyClassName="!p-4">
            <p className="text-sm font-semibold text-slate-700">
              Estado para hoy: {currentClient && isEnabledToday(currentClient.id) ? "Habilitado" : "Pendiente de pago"}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InputField
                name="payment_amount"
                type="number"
                label="Monto (Bs)"
                placeholder="0"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Método de pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-1">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Ticket asociado</label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                >
                  <option value="">Sin ticket asociado</option>
                  {clientTickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      {(ticket.ticket_code ?? `#${ticket.id}`)} · {(ticket.service_names?.length
                        ? ticket.service_names.join(" · ")
                        : ticket.service_name ?? "Sin servicio")} · {ticket.start_time.slice(0, 16)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void onRegisterPayment()}
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? "Registrando..." : "Registrar pago"}
              </Button>
            </div>
          </SectionCard>

          <SectionCard className="!rounded-xl" bodyClassName="!p-4">
            <p className="text-sm font-semibold text-slate-700">Tickets del cliente</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {clientTickets.length === 0 ? (
                <p className="text-sm text-slate-400 md:col-span-2">No hay tickets registrados para este cliente.</p>
              ) : (
                clientTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(String(ticket.id))}
                    className={`flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition ${
                      selectedTicketId === String(ticket.id)
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{ticket.ticket_code ?? `#${ticket.id}`}</p>
                      <p className="text-xs text-slate-500">
                        {ticket.service_names?.length ? ticket.service_names.join(" · ") : ticket.service_name ?? "Sin servicio"}
                      </p>
                    </div>
                    <span className="ml-3 text-xs text-slate-500">{ticket.start_time.slice(0, 16).replace("T", " ")}</span>
                  </button>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard className="!rounded-xl h-full" bodyClassName="!p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Historial de pagos</p>
          </div>

          <div className="max-h-[560px] overflow-auto rounded-b-xl">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Monto</th>
                  <th className="px-3 py-2 text-left">Método</th>
                  <th className="px-3 py-2 text-left">Ticket</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{payment.paid_at.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-3 py-2">Bs {payment.amount}</td>
                    <td className="px-3 py-2">
                      {PAYMENT_METHODS.find((method) => method.value === payment.method)?.label ?? payment.method}
                    </td>
                    <td className="px-3 py-2">
                      {payment.appointment_id
                        ? clientTickets.find((ticket) => ticket.id === payment.appointment_id)?.ticket_code ?? `#${payment.appointment_id}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          payment.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {payment.status === "paid" ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
                {clientPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      {isLoadingPayments ? "Cargando pagos..." : "Sin pagos registrados."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </GenericModal>
  );
}
