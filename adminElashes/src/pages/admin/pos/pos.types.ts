import type { RefObject } from "react";

import type {
  ProfessionalForSelect,
  ServiceCategoryOption,
  ServiceOption,
  TicketItem,
} from "../../../core/services/agenda/agenda.service";

export type CartLine = {
  localId: string;
  appointment_id?: number;
  service_id: string;
  professional_id: string;
  date: string;
  time: string;
  without_time: boolean;
  status: "pending" | "in_service";
  duration_minutes: number;
  price: number;
};

export type PosSaleClientOption = {
  id: string | number;
  nombre: string;
  apellido: string;
  phone?: string | null;
};

export type LineAvailabilityState = Record<string, { available: boolean; conflictCount: number }>;

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
  serviceComboboxRef: RefObject<HTMLDivElement | null>;
  serviceMenuRef: RefObject<HTMLDivElement | null>;
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  onContinueToAgenda: () => void;
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
  discountType: "amount" | "percent";
  discountValue: string;
  notes: string;
  cartLines: CartLine[];
  serviceSearch: string;
  selectedServiceCategoryId: string;
  sellerId: string;
};
