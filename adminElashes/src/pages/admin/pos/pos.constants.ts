import type { LucideIcon } from "lucide-react";
import { Banknote, CreditCard, QrCode, Wallet } from "lucide-react";

export const PAYMENT_METHODS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "transfer", label: "Transferencia", icon: Wallet },
  { value: "qr", label: "QR", icon: QrCode },
];

export const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50];

export const TICKET_STATUS_OPTIONS = [
  { value: "pending", label: "En espera" },
  { value: "in_service", label: "En atencion" },
] as const;
