import type { RefObject } from "react";

import type {
  ProfessionalForSelect,
  ServiceCategoryOption,
  ServiceOption,
  TicketItem,
} from "../../../core/services/agenda/agenda.service";
import type { MixedPaymentEntry } from "../../../core/services/pos-sale/pos-sale.service";

export type CartLine = {
  localId: string;
  appointment_id?: number;
  service_id: string;
  professional_id: string;
  date: string;
  time: string;
  without_time: boolean;
  /** Si el usuario editó manualmente la hora, no se sobreescribe al cobrar. */
  time_manual?: boolean;
  status: "pending" | "in_service";
  duration_minutes: number;
  price: number;
};

export type PosSaleClientOption = {
  id: string | number;
  nombre: string;
  apellido: string;
  phone?: string | null;
  status?: string | null;
  age?: number | null;
};

export type LineAvailabilityState = Record<string, { available: boolean; conflictCount: number }>;

export type PosCheckoutTicketPreview = {
  localId: string;
  serviceName: string;
  scheduleLabel: string;
  professionalName: string;
  status: string;
  /** Fecha y hora editables desde el panel. */
  date: string;
  time: string;
  without_time: boolean;
};

export type PosSaleStepOneProps = {
  labelClass: string;
  fieldClass: string;
  isLoading: boolean;
  serviceSearch: string;
  onServiceSearchChange: (value: string) => void;
  onServiceInputFocus: () => void;
  onToggleServiceMenu: () => void;
  isServiceMenuOpen: boolean;
  serviceMenuPosition: { top: number; left: number; width: number } | null;
  filteredServices: ServiceOption[];
  onServiceSelect: (serviceId: string) => void;
  selectedServiceCategoryId: string;
  onCategoryFilterChange: (value: string) => void;
  serviceCategories: ServiceCategoryOption[];
  onOpenCategoryModal: () => void;
  quickServices: ServiceOption[];
  onAddServiceToCart: (service: ServiceOption) => void;
  onRemoveServiceFromCart: (service: ServiceOption) => void;
  serviceComboboxRef: RefObject<HTMLDivElement | null>;
  serviceMenuRef: RefObject<HTMLDivElement | null>;
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  onUpdateLine: (localId: string, patch: Partial<{ service_id: string; price: number; duration_minutes: number }>) => void;
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
  mixedPayments: MixedPaymentEntry[];
  setMixedPayments: (value: MixedPaymentEntry[]) => void;
  notes: string;
  setNotes: (value: string) => void;
  onOpenRegisterClient: () => void;
  professionals: ProfessionalForSelect[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  /** Etiqueta y acción de cobro final desde el panel lateral (paso 1). */
  finalizeSaleLabel: string;
  finalizeFooterHint: string;
  onFinalizeSale: () => void;
  /** Crea turno inmediato con la hora actual, sin abrir el planificador. payLater=true → cobra al finalizar. */
  onCreateImmediateTicket: (payLater: boolean) => void;
  isSubmittingCheckout: boolean;
  linkAppointmentId: number | null;
  ticketPreviews: PosCheckoutTicketPreview[];
  onGoToScheduleStep: () => void;
  /** Modo de tickets: individual (un ticket por servicio) o grupal (un ticket para todos). */
  ticketMode: "individual" | "group";
  setTicketMode: (mode: "individual" | "group") => void;
  /** Editar hora de un ticket directamente desde el panel lateral. */
  onUpdateTicketTime: (localId: string, date: string, time: string) => void;
  onUpdateCartLine?: (localId: string, patch: Partial<{ date: string; time: string; without_time: boolean; time_manual: boolean }>) => void;
  /** URL de la imagen QR de pago estático de la sucursal activa. */
  branchQrImageUrl?: string | null;
};

export type PosSaleStepTwoProps = {
  cartLines: CartLine[];
  existingTickets: TicketItem[];
  services: ServiceOption[];
  clientDisplayName: string;
  editingSaleCode?: string | null;
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  professionals: ProfessionalForSelect[];
  lineAvailability: LineAvailabilityState;
  saleBaseDate: string;
  updateLine: (localId: string, patch: Partial<CartLine>) => void;
  setAvailabilityPreviewLineId: (value: string | null) => void;
  setAvailabilityPreviewDate: (value: string) => void;
  setAvailabilitySearch: (value: string) => void;
  isSubmitting: boolean;
  onCheckout: () => void;
  onBack: () => void;
  onOpenSalesHistory: () => void;
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
  onAddServiceToCart: (service: ServiceOption) => void;
  branchOpeningHours?: Array<{
    day: string;
    ranges: Array<{ open_time: string; close_time: string }>;
  }> | null;
};

export type ReceiptTicketEdit = {
  date: string;
  time: string;
  without_time: boolean;
  professional_id: string;
  status: "pending" | "in_service";
};

export type PosSaleDraft = {
  clientId: string;
  clientSearch: string;
  paymentMethod: string;
  mixedPayments: Array<{ method: string; amount: number }>;
  discountType: "amount" | "percent";
  discountValue: string;
  notes: string;
  cartLines: CartLine[];
  serviceSearch: string;
  selectedServiceCategoryId: string;
  sellerId: string;
};

export type { MixedPaymentEntry };
