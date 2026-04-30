import { useMemo, useState, type RefObject } from "react";
import { ChevronDown, Plus, Search, ShoppingCart, Tag, Trash2, X } from "lucide-react";
import type { ProfessionalForSelect, ServiceOption } from "../../../../core/services/agenda/agenda.service";
import type { CartLine, PosSaleClientOption } from "../pos.types";
import { PAYMENT_METHODS } from "../pos.constants";

type PosSaleDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  onChangeLineService: (localId: string, serviceId: string) => void;
  onAddServiceById: (serviceId: string) => void;
  clientComboboxRef: RefObject<HTMLDivElement | null>;
  clientSearch: string;
  setClientSearch: (value: string) => void;
  setClientId: (value: string) => void;
  isClientMenuOpen: boolean;
  setIsClientMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  filteredClients: PosSaleClientOption[];
  selectedClient: PosSaleClientOption | null;
  clientPhone: string;
  clientAddress: string;
  sellerId: string;
  setSellerId: (value: string) => void;
  discountValue: string;
  setDiscountValue: (value: string) => void;
  discountType: "amount" | "percent";
  setDiscountType: (value: "amount" | "percent") => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onOpenRegisterClient: () => void;
  professionals: ProfessionalForSelect[];
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled: boolean;
  footerHint: string;
};

export default function PosSaleDrawer({
  isOpen,
  onClose,
  cartLines,
  services,
  subtotal,
  total,
  onRemoveLine,
  onChangeLineService,
  onAddServiceById,
  clientComboboxRef,
  clientSearch,
  setClientSearch,
  setClientId,
  isClientMenuOpen,
  setIsClientMenuOpen,
  filteredClients,
  selectedClient,
  clientPhone,
  clientAddress,
  sellerId,
  setSellerId,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  paymentMethod,
  setPaymentMethod,
  notes,
  setNotes,
  onOpenRegisterClient,
  professionals,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  footerHint,
}: PosSaleDrawerProps) {
  if (!isOpen) return null;

  const cartCount = cartLines.length;
  const [serviceQuery, setServiceQuery] = useState("");
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const labelClass = "mb-1 block text-xs font-semibold text-[#605e5c]";
  const bcField =
    "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";
  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
  const filteredServices = useMemo(() => {
    if (!normalizedServiceQuery) return services.slice(0, 14);
    return services
      .filter((service) => service.name.toLowerCase().includes(normalizedServiceQuery))
      .slice(0, 14);
  }, [normalizedServiceQuery, services]);
  const lineCountByServiceId = useMemo(() => {
    const counts = new Map<string, number>();
    cartLines.forEach((line) => {
      const key = String(line.service_id || "");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [cartLines]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[43] bg-[#323130]/40 backdrop-blur-[1px]"
        aria-label="Cerrar panel de venta"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[45] flex h-full max-h-[100dvh] w-full max-w-md flex-col border-l border-[#edebe9] bg-[#faf9f8] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-sale-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-white px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="pos-sale-drawer-title" className="text-base font-semibold text-[#323130]">
              Detalle de la venta
            </p>
            <p className="truncate text-xs text-[#605e5c]">
              {cartCount} servicio(s) · Total Bs {total.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm p-2 text-[#605e5c] transition hover:bg-[#f3f2f1]"
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className="border-b border-[#edebe9]">
            <div className="flex items-center gap-2 bg-[#faf9f8] px-4 py-3">
              <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
              <span className="text-sm font-semibold text-[#323130]">Servicios en el carrito ({cartCount})</span>
            </div>
            <div className="border-b border-[#edebe9] bg-white px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase text-[#605e5c]">Agregar servicio</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                <input
                  value={serviceQuery}
                  onChange={(event) => {
                    setServiceQuery(event.target.value);
                    setIsServiceMenuOpen(true);
                  }}
                  onFocus={() => setIsServiceMenuOpen(true)}
                  placeholder="Busca servicio y agrégalo..."
                  className={`${bcField} pl-9`}
                />
                <button
                  type="button"
                  onClick={() => setIsServiceMenuOpen((current) => !current)}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
                  aria-label="Mostrar servicios"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {isServiceMenuOpen ? (
                  <div className="absolute z-[70] mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                    <div className="max-h-56 overflow-y-auto py-1">
                      {filteredServices.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron servicios.</p>
                      ) : (
                        filteredServices.map((service) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => {
                              onAddServiceById(String(service.id));
                              setServiceQuery("");
                              setIsServiceMenuOpen(false);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                          >
                            <span className="truncate text-[#323130]">{service.name}</span>
                            <span className="shrink-0 text-xs font-semibold text-[#0078d4]">
                              Bs {Number(service.price ?? 0).toFixed(2)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="px-0">
              {cartCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-[#605e5c]">
                  <ShoppingCart className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm italic">Agrega servicios desde el catálogo</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#edebe9] bg-[#faf9f8] text-[11px] font-semibold uppercase text-[#605e5c]">
                      <th className="px-4 py-2">Servicio</th>
                      <th className="px-4 py-2 text-right">Precio</th>
                      <th className="w-10 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f2f1]">
                    {cartLines.map((line) => {
                      const repeatedCount = lineCountByServiceId.get(String(line.service_id || "")) ?? 0;
                      return (
                        <tr key={line.localId} className="transition-colors hover:bg-[#f3f2f1]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={line.service_id}
                                onChange={(event) => onChangeLineService(line.localId, event.target.value)}
                                className="h-9 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                              >
                                <option value="">Servicio...</option>
                                {services.map((service) => (
                                  <option key={service.id} value={String(service.id)}>
                                    {service.name}
                                  </option>
                                ))}
                              </select>
                              {repeatedCount > 1 ? (
                                <span className="shrink-0 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[11px] font-bold text-[#0078d4]">
                                  x{repeatedCount}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-[#323130]">
                            Bs {line.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onRemoveLine(line.localId)}
                              className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                              aria-label="Quitar línea"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3 text-center text-xs text-[#605e5c]">
              Subtotal líneas: <span className="font-semibold text-[#323130]">Bs {subtotal.toFixed(2)}</span>
              {total !== subtotal ? (
                <>
                  {" "}
                  · Con descuento: <span className="font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="pb-4">
            <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
              <p className="text-sm font-semibold text-[#323130]">Datos de la venta</p>
              <p className="text-xs text-[#605e5c]">Cliente, cobro y notas</p>
            </div>
            <div className="border-b border-[#edebe9] px-4 py-4">
              <p className={labelClass}>Cliente</p>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={clientComboboxRef}>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                  <input
                    value={clientSearch}
                    onChange={(event) => {
                      setClientSearch(event.target.value);
                      setClientId("");
                      setIsClientMenuOpen(true);
                    }}
                    onFocus={() => setIsClientMenuOpen(true)}
                    placeholder="Buscar nombre, apellido o teléfono..."
                    className={`${bcField} pl-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsClientMenuOpen((current) => !current)}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
                    aria-label="Mostrar clientes"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {isClientMenuOpen ? (
                    <div className="absolute z-[70] mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                      <div className="max-h-56 overflow-y-auto py-1">
                        {filteredClients.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron clientes.</p>
                        ) : (
                          filteredClients.map((client) => {
                            const fullName = `${client.nombre} ${client.apellido}`.trim();
                            return (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setClientId(String(client.id));
                                  setClientSearch(fullName);
                                  setIsClientMenuOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                              >
                                <span className="truncate text-[#323130]">{fullName}</span>
                                <span className="ml-3 shrink-0 text-xs text-[#605e5c]">
                                  {client.phone || "Sin teléfono"}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onOpenRegisterClient}
                  title="Registrar nuevo cliente"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#605e5c] transition hover:border-[#0078d4] hover:bg-[#f3f2f1] hover:text-[#0078d4]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {selectedClient ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[11px] text-[#605e5c]">Teléfono</p>
                    <p className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">
                      {clientPhone || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-[#605e5c]">Dirección</p>
                    <p className="truncate rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">
                      {clientAddress || "—"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-b border-[#edebe9] px-4 py-4">
              <label className={labelClass} htmlFor="pos-drawer-seller">
                Vendedor
              </label>
              <div className="relative">
                <select
                  id="pos-drawer-seller"
                  value={sellerId}
                  onChange={(event) => setSellerId(event.target.value)}
                  className={`${bcField} cursor-pointer appearance-none pr-8`}
                >
                  <option value="">Seleccionar vendedor...</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.username}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
              </div>
            </div>

            <div className="space-y-4 border-b border-[#edebe9] px-4 py-4">
              <div>
                <label className={labelClass} htmlFor="pos-drawer-discount">
                  Descuento
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                    <input
                      id="pos-drawer-discount"
                      type="number"
                      min={0}
                      className={`${bcField} pl-9`}
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="relative w-24">
                    <select
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value as "amount" | "percent")}
                      className={`${bcField} cursor-pointer appearance-none pr-7 text-center`}
                    >
                      <option value="amount">Bs</option>
                      <option value="percent">%</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#605e5c]" />
                  </div>
                </div>
              </div>

              <div>
                <p className={labelClass}>Método de pago</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex flex-col items-center gap-1 rounded-sm border px-1 py-2 text-[11px] font-semibold transition-colors ${
                        paymentMethod === value
                          ? "border-[#0078d4] bg-[#0078d4] text-white shadow-sm"
                          : "border-[#edebe9] bg-[#faf9f8] text-[#605e5c] hover:border-[#c8c6c4] hover:text-[#323130]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="pos-drawer-notes">
                  Notas
                </label>
                <textarea
                  id="pos-drawer-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className={`${bcField} resize-none py-2`}
                  placeholder="Observaciones opcionales..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#edebe9] bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-center justify-between rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
            <span className="text-xs font-semibold text-[#605e5c]">Total a cobrar</span>
            <span className="text-lg font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              cartLines.forEach((line) => onRemoveLine(line.localId));
            }}
            disabled={cartCount === 0}
            className={`mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-sm border text-sm font-semibold transition-all ${
              cartCount === 0
                ? "cursor-not-allowed border-[#edebe9] bg-[#f3f2f1] text-[#a19f9d]"
                : "border-[#f1bfc6] bg-[#fff4f5] text-[#a4262c] hover:bg-[#fde7e9]"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            Vaciar carrito
          </button>
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryActionDisabled}
            className={`flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition-all ${
              primaryActionDisabled
                ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
                : "bg-[#0078d4] text-white shadow-sm hover:bg-[#005a9e] active:bg-[#004578]"
            }`}
          >
            {primaryActionLabel}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#605e5c]">{footerHint}</p>
        </div>
      </div>
    </>
  );
}
