import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import {
  AgendaService,
  deriveServiceCategoriesFromServices,
  type TicketItem,
  type ServiceCategoryOption,
  type ProfessionalForSelect,
  type ServiceOption,
  type ClientForSelect,
} from "../../../core/services/agenda/agenda.service";
import {
  PosSaleService,
  getApiErrorMessage,
  type PosSaleItem,
} from "../../../core/services/pos-sale/pos-sale.service";
import { ClientService } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import { ProductService } from "../../../core/services/product/product.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import type { RootState } from "../../../store";
import type { Product } from "../../../core/types/IProduct";
import type { CartLine, PosSaleDraft, ProductCartLine, ReceiptTicketEdit } from "./pos.types";

import {
  getLocalDateInputValue,
  getLocalTimeValue,
  formatLocalDateTime,
  getPosDraftStorageKey,
  createLocalId,
  isCartLine,
  normalizeCartLine,
  applySaleExecutionSchedule,
  applySellerToCartLines,
  prepareCartLinesForTicketCheckout,
  createDefaultLine,
  toDateAndTimeInputValues,
  formatHourMinute,
} from "./pos.helpers";

export type BranchData = {
  id: number;
  name: string;
  address?: string | null;
  opening_hours?: Array<{ day: string; ranges: Array<{ open_time: string; close_time: string }> }> | null;
  qr_image_url?: string | null;
};

export type UsePosPageOptions = {
  embedded: boolean;
  initialDate?: string;
  section?: "sale" | "history" | "tickets";
  onCartCountChange?: (count: number) => void;
  onPendingPaymentCountChange?: (count: number) => void;
  cartDrawerSignal?: number;
};

export function usePosPage({
  embedded,
  initialDate,
  section,
  onCartCountChange,
  onPendingPaymentCountChange,
  cartDrawerSignal,
}: UsePosPageOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedUser = useSelector((state: RootState) => state.auth.user);

  // ── Tab / Step ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"sale" | "history" | "lastticket">(
    section === "history" ? "history" : "sale"
  );
  const [step, setStep] = useState<1 | 2>(1);

  // ── Remote data ───────────────────────────────────────────────────────────
  const [clients, setClients]               = useState<ClientForSelect[]>([]);
  const [services, setServices]             = useState<ServiceOption[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryOption[]>([]);
  const [professionals, setProfessionals]   = useState<ProfessionalForSelect[]>([]);
  const [sales, setSales]                   = useState<PosSaleItem[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [existingTickets, setExistingTickets] = useState<TicketItem[]>([]);
  const [eyeTypes, setEyeTypes]             = useState<EyeTypeOption[]>([]);
  const [branches, setBranches]             = useState<BranchData[]>([]);
  const [eyeTypesError, setEyeTypesError]   = useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [isLoading, setIsLoading]           = useState(false);

  // ── Branch ────────────────────────────────────────────────────────────────
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());

  // ── Sale form ─────────────────────────────────────────────────────────────
  const [clientId, setClientId]             = useState("");
  const [clientSearch, setClientSearch]     = useState("");
  const [paymentMethod, setPaymentMethod]   = useState("");
  const [mixedPayments, setMixedPayments]   = useState<Array<{ method: string; amount: number }>>([]);
  const [discountType, setDiscountType]     = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue]   = useState("0");
  const [notes, setNotes]                   = useState("");
  const [cartLines, setCartLines]           = useState<CartLine[]>([]);
  const [productLines, setProductLines]     = useState<ProductCartLine[]>([]);
  const [serviceSearch, setServiceSearch]   = useState("");
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState("all");
  const [sellerId, setSellerId]             = useState("");
  const [ticketMode, setTicketMode]         = useState<"individual" | "group">("individual");
  const [linkAppointmentId, setLinkAppointmentId] = useState<number | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting]               = useState(false);
  const [receiptSale, setReceiptSale]                 = useState<PosSaleItem | null>(null);
  const [editingSale, setEditingSale]                 = useState<PosSaleItem | null>(null);
  const [confirmCancelSale, setConfirmCancelSale]     = useState<PosSaleItem | null>(null);
  const [confirmDeleteSale, setConfirmDeleteSale]     = useState<PosSaleItem | null>(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);
  const [isRegisterClientOpen, setIsRegisterClientOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen]       = useState(false);
  const [isCartOpen, setIsCartOpen]                   = useState(false);
  const [isServiceMenuOpen, setIsServiceMenuOpen]     = useState(false);
  const [serviceMenuPosition, setServiceMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalSearch, setCategoryModalSearch] = useState("");
  const [categoryModalFilterId, setCategoryModalFilterId] = useState("all");
  const [availabilityPreviewLineId, setAvailabilityPreviewLineId] = useState<string | null>(null);
  const [availabilityPreviewDate, setAvailabilityPreviewDate]     = useState("");
  const [availabilitySearch, setAvailabilitySearch]               = useState("");
  const [isPrintPreviewOpen, setIsPrintPreviewOpen]               = useState(false);
  const [receiptTicketEdits, setReceiptTicketEdits]               = useState<Record<number, ReceiptTicketEdit>>({});
  const [isSavingReceiptTickets, setIsSavingReceiptTickets]       = useState(false);
  const [printFormat, setPrintFormat]                             = useState<"a4" | "thermal">("a4");
  const [isDraftHydrated, setIsDraftHydrated]                     = useState(false);

  // ── History filters & pagination ──────────────────────────────────────────
  const [historySearch, setHistorySearch]           = useState("");
  const [historyClientFilter, setHistoryClientFilter] = useState("");
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState("all");
  const [historyDateFrom, setHistoryDateFrom]       = useState("");
  const [historyDateTo, setHistoryDateTo]           = useState("");
  const [colFilters, setColFilters] = useState({ sale_code: "", client: "", payment_method: "", total: "" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const qrRef               = useRef<HTMLDivElement | null>(null);
  const clientComboboxRef   = useRef<HTMLDivElement | null>(null);
  const serviceComboboxRef  = useRef<HTMLDivElement | null>(null);
  const serviceMenuRef      = useRef<HTMLDivElement | null>(null);
  const agendaHydrateDoneRef  = useRef<number | null>(null);
  const didSanitizeDraftRef   = useRef(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const saleBaseDate    = initialDate || getLocalDateInputValue();
  const selectedClient  = clients.find((c) => String(c.id) === clientId) ?? null;
  const clientPhone     = selectedClient?.phone?.trim() ?? "";
  const clientAddress   = selectedClient ? `Calle ${selectedClient.id} #${String(selectedClient.id).padStart(2, "0")}` : "";
  const numericDiscount = Number(discountValue) || 0;

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const normalizedTermDigits = term.replace(/\D/g, "");
    const base = term
      ? clients.filter((c) => {
          const fullName = `${c.nombre} ${c.apellido}`.toLowerCase();
          const phone = (c.phone ?? "").toLowerCase();
          return (
            fullName.includes(term) ||
            (Boolean(phone) && phone.includes(term)) ||
            (Boolean(normalizedTermDigits) && phone.replace(/\D/g, "").includes(normalizedTermDigits))
          );
        })
      : clients;
    const selectedInList = base.some((c) => String(c.id) === clientId);
    const selected = selectedClient && !selectedInList ? [selectedClient as typeof clients[0]] : [];
    return [...selected, ...base];
  }, [clients, clientSearch, clientId, selectedClient]);

  const filteredServices = useMemo(() => {
    const categoryFiltered = selectedServiceCategoryId === "all"
      ? services
      : services.filter((s) => {
          const catId = s.category_id ?? s.category?.id ?? null;
          return String(catId ?? "") === selectedServiceCategoryId;
        });
    const term = serviceSearch.trim().toLowerCase();
    if (!term) return categoryFiltered;
    return categoryFiltered.filter((s) => s.name.toLowerCase().includes(term) || s.price.toFixed(2).includes(term));
  }, [services, serviceSearch, selectedServiceCategoryId]);

  const productsSubtotal = useMemo(
    () => productLines.reduce((s, l) => s + l.unit_price * l.quantity, 0),
    [productLines]
  );
  const subtotal       = useMemo(
    () => cartLines.reduce((s, l) => s + l.price, 0) + productsSubtotal,
    [cartLines, productsSubtotal]
  );
  const discountAmount = useMemo(
    () => (discountType === "percent" ? subtotal * (numericDiscount / 100) : numericDiscount),
    [discountType, numericDiscount, subtotal]
  );
  const total        = Math.max(0, subtotal - discountAmount);
  const quickServices = useMemo(() => filteredServices.slice(0, 12), [filteredServices]);

  const categoryModalSelectionCounts = useMemo(() => {
    if (!isCategoryModalOpen) return {};
    const counts: Record<string, number> = {};
    for (const line of cartLines) {
      if (!line.service_id) continue;
      counts[line.service_id] = (counts[line.service_id] ?? 0) + 1;
    }
    return counts;
  }, [isCategoryModalOpen, cartLines]);

  const filteredModalServices = useMemo(() => {
    const term = categoryModalSearch.trim().toLowerCase();
    const base = categoryModalFilterId === "all"
      ? services
      : services.filter((s) => {
          const catId = s.category_id ?? s.category?.id ?? null;
          return String(catId ?? "") === categoryModalFilterId;
        });
    if (!term) return base;
    return base.filter((s) => s.name.toLowerCase().includes(term) || s.price.toFixed(2).includes(term));
  }, [services, categoryModalSearch, categoryModalFilterId]);

  const historyClientOptions = useMemo(() =>
    Array.from(new Set(sales.map((s) => `${s.client?.name ?? ""} ${s.client?.last_name ?? ""}`.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [sales]
  );

  const historyPaymentOptions = useMemo(() =>
    Array.from(new Set(sales.map((s) => (s.payment_method ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [sales]
  );

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const clientName = `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`.toLowerCase();
      const pm = (sale.payment_method ?? "").trim().toLowerCase();
      const saleDate = String(sale.created_at ?? "").slice(0, 10);
      const globalMatch = !historySearch ||
        sale.sale_code.toLowerCase().includes(historySearch.toLowerCase()) ||
        clientName.includes(historySearch.toLowerCase()) ||
        String(sale.total).includes(historySearch);
      const topFiltersMatch =
        (!historyClientFilter || clientName.includes(historyClientFilter.toLowerCase())) &&
        (historyPaymentFilter === "all" || pm === historyPaymentFilter.toLowerCase()) &&
        (!historyDateFrom || saleDate >= historyDateFrom) &&
        (!historyDateTo || saleDate <= historyDateTo);
      const colMatch =
        (!colFilters.sale_code      || sale.sale_code.toLowerCase().includes(colFilters.sale_code.toLowerCase())) &&
        (!colFilters.client         || clientName.includes(colFilters.client.toLowerCase())) &&
        (!colFilters.payment_method || pm.includes(colFilters.payment_method.toLowerCase())) &&
        (!colFilters.total          || String(sale.total).includes(colFilters.total));
      return globalMatch && topFiltersMatch && colMatch;
    });
  }, [sales, historySearch, historyClientFilter, historyPaymentFilter, historyDateFrom, historyDateTo, colFilters]);

  const filteredSalesTotalAmount = useMemo(() => filteredSales.reduce((s, sale) => s + Number(sale.total ?? 0), 0), [filteredSales]);
  const allSalesTotalAmount      = useMemo(() => sales.reduce((s, sale) => s + Number(sale.total ?? 0), 0), [sales]);
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage));
  const pagedSales = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, currentPage, rowsPerPage]);

  const editingAppointmentIds = useMemo(() => {
    if (!editingSale) return new Set<number>();
    return new Set(editingSale.appointments.map((a) => a.id));
  }, [editingSale]);

  const getLineDateRange = (line: CartLine) => {
    const safeDate = line.date?.trim() || saleBaseDate;
    const safeTime = line.without_time ? "09:00" : (line.time?.trim() || "09:00");
    const start = new Date(`${safeDate}T${safeTime}:00`);
    return { start, end: new Date(start.getTime() + line.duration_minutes * 60 * 1000) };
  };

  const lineAvailability = useMemo(() => {
    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
      aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
    const freeStatuses = new Set(["cancelled", "completed", "finalizado", "atendido", "done", "no_show"]);
    const result: Record<string, { available: boolean; conflictCount: number }> = {};

    for (let index = 0; index < cartLines.length; index += 1) {
      const line = cartLines[index];
      if (!line.professional_id || !Number.isFinite(Number(line.professional_id)) || line.without_time || !line.time?.trim()) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }
      const professionalId = Number(line.professional_id);
      const { start, end } = getLineDateRange(line);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        result[line.localId] = { available: false, conflictCount: 1 };
        continue;
      }
      let conflictCount = 0;
      for (let i = 0; i < cartLines.length; i += 1) {
        if (i === index) continue;
        const other = cartLines[i];
        if (Number(other.professional_id) !== professionalId || other.without_time || !other.time?.trim()) continue;
        const otherRange = getLineDateRange(other);
        if (overlaps(start, end, otherRange.start, otherRange.end)) conflictCount += 1;
      }
      for (const ticket of existingTickets) {
        if (freeStatuses.has(ticket.status ?? "") || editingAppointmentIds.has(ticket.id) || Number(ticket.professional_id) !== professionalId) continue;
        const ticketStart = new Date(ticket.start_time);
        const ticketEnd = new Date(ticket.end_time);
        if (!Number.isNaN(ticketStart.getTime()) && !Number.isNaN(ticketEnd.getTime()) && overlaps(start, end, ticketStart, ticketEnd)) conflictCount += 1;
      }
      result[line.localId] = { available: conflictCount === 0, conflictCount };
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLines, editingAppointmentIds, existingTickets, saleBaseDate]);

  const checkoutTicketPreviews = useMemo(() => {
    if (cartLines.length === 0 || linkAppointmentId) return [];
    const withSeller = applySellerToCartLines(cartLines, sellerId);

    if (ticketMode === "group" && withSeller.length > 1) {
      const firstLine = withSeller[0];
      const totalDuration = withSeller.reduce((acc, l) => acc + (l.duration_minutes || 60), 0);
      let start: Date;
      if (firstLine.time_manual && firstLine.date && firstLine.time) {
        start = new Date(`${firstLine.date}T${firstLine.time}:00`);
        if (Number.isNaN(start.getTime())) start = new Date();
      } else {
        start = new Date();
      }
      const end = new Date(start.getTime() + totalDuration * 60 * 1000);
      const durLabel = totalDuration >= 60
        ? `${Math.floor(totalDuration / 60)}h${totalDuration % 60 > 0 ? ` ${totalDuration % 60}min` : ""}`
        : `${totalDuration}min`;
      const firstProfId = withSeller.find((l) => l.professional_id)?.professional_id;
      const professional = firstProfId ? professionals.find((p) => String(p.id) === firstProfId) : null;
      return [{
        localId: firstLine.localId,
        serviceName: withSeller.map((l) => services.find((s) => String(s.id) === l.service_id)?.name ?? "Servicio").join(" + "),
        scheduleLabel: `${getLocalDateInputValue(start)} ${getLocalTimeValue(start)} – ${getLocalTimeValue(end)} (${durLabel} total)`,
        professionalName: professional?.username ?? "Sin operaria",
        status: "Pendiente" as const,
        date: firstLine.time_manual && firstLine.date ? firstLine.date : getLocalDateInputValue(start),
        time: firstLine.time_manual && firstLine.time ? firstLine.time : getLocalTimeValue(start),
        without_time: false,
      }];
    }

    let cursor = Date.now();
    return withSeller.map((line) => {
      const service      = services.find((s) => String(s.id) === line.service_id);
      const professional = professionals.find((p) => String(p.id) === line.professional_id);
      const durationMs   = Math.max(Number(line.duration_minutes) || 60, 1) * 60 * 1000;
      let start: Date;
      if (line.time_manual && line.date && line.time) {
        start = new Date(`${line.date}T${line.time}:00`);
        if (Number.isNaN(start.getTime())) start = new Date(cursor);
      } else {
        start = new Date(cursor);
      }
      const end = new Date(start.getTime() + durationMs);
      cursor = end.getTime();
      const durMins = Math.max(Number(line.duration_minutes) || 60, 1);
      const durLabel = durMins >= 60
        ? `${Math.floor(durMins / 60)}h${durMins % 60 > 0 ? `${durMins % 60}min` : ""}`
        : `${durMins}min`;
      return {
        localId: line.localId,
        serviceName: service?.name ?? "Servicio",
        scheduleLabel: line.without_time
          ? `${line.date} · sin hora fija · ${durLabel}`
          : `${getLocalDateInputValue(start)} ${getLocalTimeValue(start)} – ${getLocalTimeValue(end)} (${durLabel})`,
        professionalName: professional?.username ?? "Sin operaria",
        status: line.status === "in_service" ? "En atención" : ("Pendiente" as const),
        date: line.time_manual && line.date ? line.date : getLocalDateInputValue(start),
        time: line.time_manual && line.time ? line.time : getLocalTimeValue(start),
        without_time: line.without_time,
      };
    });
  }, [cartLines, sellerId, services, professionals, linkAppointmentId, ticketMode]);

  const activeAvailabilityLine = useMemo(
    () => cartLines.find((l) => l.localId === availabilityPreviewLineId) ?? null,
    [cartLines, availabilityPreviewLineId]
  );

  const occupiedTicketsForPreview = useMemo(() => {
    if (!activeAvailabilityLine) return [];
    const targetDate = availabilityPreviewDate.trim() || activeAvailabilityLine.date?.trim() || saleBaseDate;
    const term = availabilitySearch.trim().toLowerCase();
    const freeStatuses = new Set(["cancelled", "completed", "finalizado", "atendido", "done", "no_show"]);
    const resolveName = (t: TicketItem) =>
      t.professional_name?.trim() || professionals.find((p) => p.id === t.professional_id)?.username || "Sin operaria";
    return existingTickets
      .filter((t) => {
        if (freeStatuses.has(t.status ?? "") || t.start_time.slice(0, 10) !== targetDate) return false;
        if (!term) return true;
        return resolveName(t).toLowerCase().includes(term) ||
          (t.client_name ?? "").toLowerCase().includes(term) ||
          `${t.service_name ?? ""} ${(t.service_names ?? []).join(" ")}`.toLowerCase().includes(term);
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [activeAvailabilityLine, availabilityPreviewDate, availabilitySearch, existingTickets, professionals, saleBaseDate]);

  const previewHourSlots = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => {
      const hourLabel  = `${String(hour).padStart(2, "0")}:00`;
      const hourPrefix = `${String(hour).padStart(2, "0")}:`;
      const hourTickets = occupiedTicketsForPreview.filter((t) => formatHourMinute(t.start_time).startsWith(hourPrefix));
      const entries = hourTickets.slice(0, 3).map((t) => ({
        ticketId: t.id,
        professionalName: t.professional_name ?? professionals.find((p) => p.id === t.professional_id)?.username ?? "Sin operaria",
        clientName: t.client_name ?? "Sin cliente",
        serviceName: (t.service_name ?? (t.service_names ?? []).join(" · ")) || "Servicio",
      }));
      return { hourLabel, isBusy: hourTickets.length > 0, count: hourTickets.length, entries, extraCount: Math.max(0, hourTickets.length - entries.length) };
    });
  }, [occupiedTicketsForPreview, professionals]);

  // ── UI helpers ────────────────────────────────────────────────────────────

  const updateServiceMenuPosition = () => {
    if (!serviceComboboxRef.current) return;
    const rect = serviceComboboxRef.current.getBoundingClientRect();
    setServiceMenuPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (clientComboboxRef.current && !clientComboboxRef.current.contains(event.target as Node)) setIsClientMenuOpen(false);
      if (!serviceComboboxRef.current?.contains(event.target as Node) && !serviceMenuRef.current?.contains(event.target as Node)) setIsServiceMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!isServiceMenuOpen) return;
    updateServiceMenuPosition();
    window.addEventListener("resize", updateServiceMenuPosition);
    window.addEventListener("scroll", updateServiceMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateServiceMenuPosition);
      window.removeEventListener("scroll", updateServiceMenuPosition, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServiceMenuOpen]);

  useEffect(() => {
    if (!isCategoryModalOpen) return;
    setCategoryModalFilterId(selectedServiceCategoryId || "all");
    setCategoryModalSearch("");
  }, [isCategoryModalOpen, selectedServiceCategoryId]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadContext = async () => {
    setIsLoading(true);
    try {
      const branchFilter = activeBranchId ?? undefined;
      const settled = await Promise.allSettled([
        AgendaService.listClientsForSelect({ limit: 200, branch_id: branchFilter }),
        AgendaService.listServices({ limit: 200, branch_id: branchFilter }),
        AgendaService.listServiceCategories(),
        AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria", branch_id: branchFilter }),
        PosSaleService.list({ limit: 100, branch_id: branchFilter }),
        AgendaService.listTickets({ limit: 500, branch_id: branchFilter, start_date: saleBaseDate, end_date: saleBaseDate }),
        ProductService.listProducts({ limit: 200, branch_id: branchFilter, active_only: true }),
      ]);
      const labels = ["Clientes", "Servicios", "Categorias", "Profesionales", "Ventas", "Agenda", "Productos"] as const;
      const failures: string[] = [];

      if (settled[0].status === "fulfilled") setClients(settled[0].value);
      else failures.push(`${labels[0]}: ${getApiErrorMessage(settled[0].reason, "Error al cargar clientes.")}`);

      if (settled[1].status === "fulfilled") setServices(settled[1].value);
      else failures.push(`${labels[1]}: ${getApiErrorMessage(settled[1].reason, "Error al cargar servicios.")}`);

      if (settled[2].status === "fulfilled") {
        setServiceCategories(settled[2].value);
      } else {
        const derived = deriveServiceCategoriesFromServices(settled[1].status === "fulfilled" ? settled[1].value : []);
        setServiceCategories(derived.length > 0 ? derived : []);
        if (derived.length === 0) failures.push(`${labels[2]}: ${getApiErrorMessage(settled[2].reason, "Error al cargar categorias.")}`);
      }

      if (settled[3].status === "fulfilled") setProfessionals(settled[3].value);
      else failures.push(`${labels[3]}: ${getApiErrorMessage(settled[3].reason, "Error al cargar profesionales.")}`);

      if (settled[4].status === "fulfilled") {
        const sales = settled[4].value;
        setSales(sales);
        onPendingPaymentCountChange?.(
          sales.filter((s) => s.status !== "paid" && s.status !== "cancelled" && s.appointments.some((a) => a.status === "completed")).length
        );
      } else {
        failures.push(`${labels[4]}: ${getApiErrorMessage(settled[4].reason, "Error al cargar ventas.")}`);
        setSales([]);
      }

      if (settled[5].status === "fulfilled") setExistingTickets(settled[5].value);
      else {
        failures.push(`${labels[5]}: ${getApiErrorMessage(settled[5].reason, "Error al cargar tickets de agenda.")}`);
        setExistingTickets([]);
      }

      if (settled[6].status === "fulfilled") setProducts(settled[6].value);
      else {
        failures.push(`${labels[6]}: ${getApiErrorMessage(settled[6].reason, "Error al cargar productos.")}`);
        setProducts([]);
      }

      if (failures.length > 0) {
        const deduped = [...new Set(failures)];
        toast.error(deduped.length === 1 ? deduped[0] : `No se cargó todo: ${deduped.join(" · ")}`);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudieron cargar los datos."));
    } finally {
      setIsLoading(false);
    }
  };

  const loadEyeTypes = async () => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    try {
      const data = await ClientService.listEyeTypes({ limit: 100 });
      setEyeTypes(data.length > 0 ? data : []);
    } catch (err) {
      console.error("Error cargando tipos de ojos:", err);
      setEyeTypesError("No se pudieron cargar. Intenta de nuevo.");
    } finally {
      setIsLoadingEyeTypes(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadContext(); }, [activeBranchId]);
  useEffect(() => { void loadEyeTypes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isCartOpen) return;
    AgendaService.listProfessionalsForSelect({ limit: 200, role_name: "Operaria", branch_id: activeBranchId ?? undefined })
      .then((data) => setProfessionals(data)).catch(() => {});
  }, [isCartOpen, activeBranchId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId)); }, []);

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch((err) => { console.error("Error cargando sucursales:", err); setBranches([]); });
  }, []);

  useEffect(() => {
    setIsDraftHydrated(false);
    const draftKey = getPosDraftStorageKey(activeBranchId);
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) { setIsDraftHydrated(true); return; }
      const parsed = JSON.parse(raw) as Partial<PosSaleDraft>;
      const parsedCartLines = Array.isArray(parsed.cartLines)
        ? parsed.cartLines.filter(isCartLine).map(normalizeCartLine) : [];
      const parsedProductLines = Array.isArray(parsed.productLines)
        ? parsed.productLines.filter(
            (l): l is ProductCartLine =>
              Boolean(l) && typeof l.localId === "string" && typeof l.product_id === "string" && typeof l.quantity === "number"
          )
        : [];
      setClientId(typeof parsed.clientId === "string" ? parsed.clientId : "");
      setClientSearch(typeof parsed.clientSearch === "string" ? parsed.clientSearch : "");
      setPaymentMethod(typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "");
      setMixedPayments(
        Array.isArray(parsed.mixedPayments)
          ? (parsed.mixedPayments as Array<{ method: string; amount: number }>).filter((e) => typeof e.method === "string" && typeof e.amount === "number")
          : []
      );
      setDiscountType(parsed.discountType === "percent" ? "percent" : "amount");
      setDiscountValue(typeof parsed.discountValue === "string" ? parsed.discountValue : "0");
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
      setCartLines(parsedCartLines);
      setProductLines(parsedProductLines);
      setServiceSearch(typeof parsed.serviceSearch === "string" ? parsed.serviceSearch : "");
      setSelectedServiceCategoryId(typeof parsed.selectedServiceCategoryId === "string" ? parsed.selectedServiceCategoryId : "all");
      setSellerId(typeof parsed.sellerId === "string" ? parsed.sellerId : "");
    } catch (error) {
      console.error("Error leyendo borrador POS:", error);
      sessionStorage.removeItem(draftKey);
    } finally {
      setIsDraftHydrated(true);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (!isDraftHydrated || services.length === 0) return;
    const navState = location.state as { fromAgendaReservation?: { appointmentId: number } } | null;
    const appointmentId = navState?.fromAgendaReservation?.appointmentId;
    if (!appointmentId || agendaHydrateDoneRef.current === appointmentId) return;

    let cancelled = false;
    void (async () => {
      try {
        const ticket = await AgendaService.getAppointment(appointmentId);
        if (cancelled) return;
        if (ticket.sale_id) { toast.warning("Esta reserva ya tiene una venta registrada."); agendaHydrateDoneRef.current = appointmentId; return; }
        const rawIds = ticket.service_ids?.filter((id) => id != null && Number(id) > 0).map(Number);
        const serviceIds = rawIds && rawIds.length > 0 ? rawIds : ticket.service_id ? [ticket.service_id] : [];
        if (serviceIds.length === 0) { toast.warning("La reserva no tiene servicios para cobrar."); agendaHydrateDoneRef.current = appointmentId; return; }
        const startMs = new Date(ticket.start_time).getTime();
        const endMs   = new Date(ticket.end_time).getTime();
        const totalDurationMins = Math.max(15, Math.round(Math.max(endMs - startMs, 60_000) / 60_000));
        const primarySvcId = serviceIds[0];
        const primarySvc   = services.find((s) => s.id === primarySvcId);
        const totalPrice   = serviceIds.reduce((sum, id, i) => {
          const svc = services.find((s) => s.id === id);
          return sum + (svc?.price ?? Number(ticket.service_prices?.[i] ?? ticket.service_price ?? 0));
        }, 0);
        const dt = toDateAndTimeInputValues(formatLocalDateTime(new Date(startMs)));
        const lines: CartLine[] = [normalizeCartLine({
          localId: createLocalId(), appointment_id: appointmentId, service_id: String(primarySvcId),
          professional_id: ticket.professional_id != null ? String(ticket.professional_id) : "",
          date: dt.date, time: dt.time, without_time: dt.without_time, status: "pending",
          duration_minutes: totalDurationMins, price: totalPrice || primarySvc?.price || 0,
        })];
        agendaHydrateDoneRef.current = appointmentId;
        setClientId(String(ticket.client_id)); setClientSearch(""); setCartLines(lines);
        setLinkAppointmentId(appointmentId); setStep(1);
        toast.info("Reserva cargada: mismo día y hora de la agenda. Cobrá desde el carrito con «Finalizar venta».");
      } catch {
        toast.error("No se pudo cargar la reserva desde la agenda.");
        agendaHydrateDoneRef.current = appointmentId;
      } finally {
        if (!cancelled) navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
      }
    })();
    return () => { cancelled = true; };
  }, [isDraftHydrated, services, location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (sellerId || professionals.length === 0 || !loggedUser) return;
    const normalizedEmail = (loggedUser.email ?? "").trim().toLowerCase();
    const normalizedName  = (loggedUser.name ?? loggedUser.full_name ?? "").trim().toLowerCase();
    const match =
      professionals.find((p) => Number(p.id) === Number(loggedUser.id)) ??
      (normalizedEmail ? professionals.find((p) => p.email.trim().toLowerCase() === normalizedEmail) : undefined) ??
      (normalizedName  ? professionals.find((p) => p.username.trim().toLowerCase() === normalizedName) : undefined);
    if (match) setSellerId(String(match.id));
  }, [sellerId, professionals, loggedUser]);

  useEffect(() => {
    if (!isDraftHydrated || professionals.length === 0 || didSanitizeDraftRef.current) return;
    didSanitizeDraftRef.current = true;
    const validIds = new Set(professionals.map((p) => String(p.id)));
    setSellerId((current) => (current && !validIds.has(current) ? "" : current));
    setCartLines((prev) => prev.map((line) =>
      line.professional_id && !validIds.has(line.professional_id) ? { ...line, professional_id: "" } : line
    ));
  }, [isDraftHydrated, professionals]);

  useEffect(() => {
    if (services.length === 0) return;
    setCartLines((prev) => prev.map((line) => {
      const svc = services.find((s) => String(s.id) === line.service_id);
      if (!svc) return line;
      const syncedPrice    = Number(svc.price ?? line.price);
      const syncedDuration = Math.max(1, Number(svc.duration_minutes ?? line.duration_minutes));
      if (line.price === syncedPrice && line.duration_minutes === syncedDuration) return line;
      return { ...line, price: syncedPrice, duration_minutes: syncedDuration };
    }));
  }, [services]);

  useEffect(() => {
    if (!isDraftHydrated) return;
    const draftKey = getPosDraftStorageKey(activeBranchId);
    const isEmpty =
      !clientId && !clientSearch && (!paymentMethod || paymentMethod === "cash") &&
      discountType === "amount" && (discountValue === "" || discountValue === "0") &&
      !notes.trim() && cartLines.length === 0 && productLines.length === 0 && !serviceSearch && selectedServiceCategoryId === "all" && !sellerId;
    if (isEmpty) { sessionStorage.removeItem(draftKey); return; }
    sessionStorage.setItem(draftKey, JSON.stringify({ clientId, clientSearch, paymentMethod, mixedPayments, discountType, discountValue, notes, cartLines, productLines, serviceSearch, selectedServiceCategoryId, sellerId } as PosSaleDraft));
  }, [isDraftHydrated, activeBranchId, clientId, clientSearch, paymentMethod, mixedPayments, discountType, discountValue, notes, cartLines, productLines, serviceSearch, selectedServiceCategoryId, sellerId]);

  useEffect(() => { setCurrentPage(1); }, [historySearch, historyClientFilter, historyPaymentFilter, historyDateFrom, historyDateTo, colFilters, rowsPerPage]);
  useEffect(() => { if (section) setActiveTab(section); }, [section]);
  useEffect(() => {
    onCartCountChange?.(cartLines.length + productLines.length);
  }, [cartLines.length, productLines.length, onCartCountChange]);
  useEffect(() => {
    if (!cartDrawerSignal) return;
    setActiveTab("sale"); setStep(1); setIsCartOpen(true);
  }, [cartDrawerSignal]);

  useEffect(() => {
    const handleChange = () => {
      setActiveBranchId(getSelectedBranchId());
      setClientId(""); setClientSearch(""); setServiceSearch(""); setCartLines([]);
    };
    const onStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("branchchange", handleChange);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("branchchange", handleChange); };
  }, []);

  useEffect(() => {
    if (!availabilityPreviewLineId) return;
    if (!cartLines.some((l) => l.localId === availabilityPreviewLineId)) {
      setAvailabilityPreviewLineId(null); setAvailabilityPreviewDate(""); setAvailabilitySearch("");
    }
  }, [availabilityPreviewLineId, cartLines]);

  useEffect(() => {
    if (!receiptSale) { setReceiptTicketEdits({}); return; }
    const edits: Record<number, ReceiptTicketEdit> = {};
    receiptSale.appointments.forEach((appt) => {
      const when = toDateAndTimeInputValues(appt.start_time);
      edits[appt.id] = { date: when.date, time: when.time, without_time: when.without_time,
        professional_id: appt.professional?.id ? String(appt.professional.id) : "",
        status: appt.status === "in_service" ? "in_service" : "pending" };
    });
    setReceiptTicketEdits(edits);
  }, [receiptSale]);

  // ── Cart operations ───────────────────────────────────────────────────────

  const addServiceToCart = (service: ServiceOption) =>
    setCartLines((prev) => [...prev, { ...createDefaultLine(service), date: saleBaseDate, professional_id: "" }]);

  const removeLastCartLineForService = (serviceId: string) => {
    setCartLines((prev) => {
      const revIdx = [...prev].reverse().findIndex((l) => l.service_id === serviceId);
      if (revIdx === -1) return prev;
      return prev.filter((_, i) => i !== prev.length - 1 - revIdx);
    });
  };

  const removeLine = (localId: string) => setCartLines((prev) => prev.filter((l) => l.localId !== localId));

  const updateLine = (localId: string, patch: Partial<CartLine>) => {
    setCartLines((prev) => prev.map((line) => {
      if (line.localId !== localId) return line;
      const nextLine: CartLine = { ...line, ...patch };
      if (patch.service_id && patch.service_id !== line.service_id) {
        const svc = services.find((s) => String(s.id) === patch.service_id);
        if (svc) { nextLine.price = Number(svc.price ?? 0); nextLine.duration_minutes = Math.max(1, Number(svc.duration_minutes ?? 60)); }
      }
      return nextLine;
    }));
  };

  const handleUpdateTicketTime = (localId: string, date: string, time: string) =>
    updateLine(localId, { date, time, without_time: false, time_manual: true });

  // ── Productos (inventario) en el carrito ───────────────────────────────────

  const addProductToCart = (product: Product) => {
    setProductLines((prev) => {
      const existing = prev.find((l) => l.product_id === String(product.id));
      if (existing) {
        if (existing.quantity >= existing.availableStock) {
          toast.warning(`No hay más stock disponible de "${product.name}".`);
          return prev;
        }
        return prev.map((l) =>
          l.localId === existing.localId ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      if (product.stock <= 0) {
        toast.warning(`"${product.name}" no tiene stock en esta sucursal.`);
        return prev;
      }
      return [
        ...prev,
        {
          localId: createLocalId(),
          product_id: String(product.id),
          name: product.name,
          unit_price: product.price,
          quantity: 1,
          availableStock: product.stock,
        },
      ];
    });
  };

  const updateProductQuantity = (localId: string, quantity: number) => {
    setProductLines((prev) =>
      prev.map((l) => {
        if (l.localId !== localId) return l;
        const clamped = Math.max(1, Math.min(quantity, l.availableStock));
        return { ...l, quantity: clamped };
      })
    );
  };

  const removeProductLine = (localId: string) =>
    setProductLines((prev) => prev.filter((l) => l.localId !== localId));

  const resetSaleForm = () => {
    setEditingSale(null); setLinkAppointmentId(null); agendaHydrateDoneRef.current = null;
    setClientId(""); setClientSearch(""); setServiceSearch(""); setSelectedServiceCategoryId("all");
    setPaymentMethod(""); setMixedPayments([]); setDiscountValue("0"); setNotes(""); setCartLines([]); setProductLines([]); setSellerId("");
    sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
    if (embedded) setActiveTab("sale");
  };

  const handleServiceSelect = (serviceId: string) => {
    if (!serviceId) return;
    const service = services.find((s) => String(s.id) === serviceId);
    if (service) addServiceToCart(service);
    setServiceSearch(""); setIsServiceMenuOpen(false);
  };

  const handleSelectHourFromPreview = (hourValue: string) => {
    if (!availabilityPreviewLineId) return;
    const targetDate = availabilityPreviewDate.trim() || activeAvailabilityLine?.date?.trim() || saleBaseDate;
    updateLine(availabilityPreviewLineId, { date: targetDate, time: hourValue, without_time: false });
    toast.success(`Horario ${hourValue} aplicado al ticket.`);
    setAvailabilityPreviewLineId(null);
  };

  // ── Checkout ──────────────────────────────────────────────────────────────

  const handleImmediateCheckout = async (payLater: boolean, startService?: boolean) => {
    if (!activeBranchId)  return toast.warning("Selecciona una sucursal.");
    // "Crear turno" / "Pasar a servicio" son acciones de agenda — no aplican
    // a una venta de solo productos (sin servicio que agendar). Para vender
    // solo productos se usa "Finalizar venta" (handleCheckout).
    if (cartLines.length === 0) return toast.warning("El carrito está vacío.");
    if (!payLater && mixedPayments.length === 0 && !paymentMethod) return toast.warning("Selecciona un método de pago.");
    setIsSubmitting(true);
    try {
      let cursor = Date.now();
      const items = cartLines.map((line) => {
        const duration = Math.max(15, line.duration_minutes || 60);
        let start: Date;
        if (line.time_manual && line.date && line.time) {
          const parsed = new Date(`${line.date}T${line.time}:00`);
          start = Number.isNaN(parsed.getTime()) ? new Date(cursor) : parsed;
        } else { start = new Date(cursor); }
        const end = new Date(start.getTime() + duration * 60_000);
        cursor = end.getTime();
        return {
          service_id: Number(line.service_id),
          professional_id: line.professional_id ? Number(line.professional_id) : (sellerId ? Number(sellerId) : null),
          branch_id: activeBranchId, start_time: formatLocalDateTime(start), end_time: formatLocalDateTime(end),
        };
      });
      const sale = await PosSaleService.create({
        ...(clientId ? { client_id: Number(clientId) } : {}), branch_id: activeBranchId,
        payment_method: payLater ? "cash" : (mixedPayments.length > 0 ? "mixed" : paymentMethod),
        discount_type: discountType, discount_value: numericDiscount, notes: notes.trim() || undefined, items,
        ...(payLater ? { reservation_only: true } : {}),
        ...(!payLater && mixedPayments.length > 0 ? { mixed_payments: mixedPayments } : {}),
      });
      if (startService) {
        await Promise.all(
          sale.appointments.map((a) =>
            AgendaService.updateAppointment(a.id, { status: "in_service" })
          )
        );
      }
      toast.success(`Venta completada. Tickets: ${sale.appointments.map((a) => a.ticket_code).filter(Boolean).join(", ")}`);
      setReceiptSale(sale); resetSaleForm(); setActiveTab("lastticket");
      await loadContext();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Error al crear el turno."));
    } finally { setIsSubmitting(false); }
  };

  const handleCheckout = async () => {
    if (!activeBranchId)        return toast.warning("Selecciona una sucursal para la venta.");
    // Sin clienta elegida, el backend usa el "Cliente Mostrador" de la
    // sucursal (walk-in) — no hace falta frenar el cobro por esto.
    if (cartLines.length === 0 && productLines.length === 0) return toast.warning("El carrito está vacío.");
    if (cartLines.some((l) => l.status === "in_service" && !l.professional_id))
      return toast.warning("Si un ticket está 'En atencion', debes seleccionar operaria.");
    // Editar productos de una venta ya creada no está soportado todavía —
    // solo se pueden agregar productos al armar una venta nueva.
    if (editingSale && productLines.length > 0)
      return toast.warning("No se pueden agregar productos al editar una venta existente. Creá una venta nueva.");
    if (numericDiscount > 0) {
      const applied = discountType === "percent" ? subtotal * (numericDiscount / 100) : numericDiscount;
      if (applied >= subtotal) return toast.warning("El descuento no puede ser igual o mayor al subtotal de la venta.");
    }

    const linesScheduled = linkAppointmentId
      ? applySellerToCartLines(cartLines, sellerId)
      : prepareCartLinesForTicketCheckout(cartLines, { sellerId, applySchedule: true });

    setIsSubmitting(true);
    try {
      if (editingSale) {
        const seen = new Set<number>();
        for (const line of cartLines) {
          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end   = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
          if (line.appointment_id) {
            seen.add(line.appointment_id);
            await AgendaService.updateAppointment(line.appointment_id, {
              client_id: Number(clientId), service_id: Number(line.service_id),
              professional_id: line.professional_id ? Number(line.professional_id) : null,
              branch_id: activeBranchId, start_time: formatLocalDateTime(start), end_time: formatLocalDateTime(end),
              status: line.status, skip_availability_check: true,
            });
          } else {
            await AgendaService.createAppointment({
              client_id: Number(clientId), service_id: Number(line.service_id),
              professional_id: line.professional_id ? Number(line.professional_id) : null,
              branch_id: activeBranchId, sale_id: editingSale.id,
              start_time: formatLocalDateTime(start), end_time: formatLocalDateTime(end), status: line.status,
            });
          }
        }
        await Promise.all(editingSale.appointments.filter((a) => !seen.has(a.id)).map((a) => AgendaService.deleteAppointment(a.id)));
        const updatedSale = await PosSaleService.update(editingSale.id, {
          client_id: Number(clientId), payment_method: paymentMethod,
          discount_type: discountType, discount_value: numericDiscount, notes: notes.trim() || "",
        });
        const refreshed = await PosSaleService.getById(updatedSale.id);
        setSales((prev) => prev.map((s) => (s.id === refreshed.id ? refreshed : s)));
        setReceiptSale(refreshed);
        sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
        toast.success(`Venta ${refreshed.sale_code} actualizada.`);
        resetSaleForm(); await loadContext();
        if (!embedded) navigate("/admin/pos/history");
        return;
      }

      const buildItems = () => {
        if (ticketMode === "group" && linesScheduled.length > 1) {
          const first = linesScheduled[0];
          const safeDate = first.date?.trim() || getLocalDateInputValue();
          const safeTime = first.without_time ? "09:00" : (first.time?.trim() || getLocalTimeValue());
          const groupStart = new Date(`${safeDate}T${safeTime}:00`);
          const totalDuration = linesScheduled.reduce((acc, l) => acc + (l.duration_minutes || 60), 0);
          const groupEnd = new Date(groupStart.getTime() + totalDuration * 60 * 1000);
          const groupProfId = sellerId.trim() || linesScheduled.find((l) => l.professional_id)?.professional_id || null;
          const uniqueProfs = new Set(linesScheduled.map((l) => l.professional_id).filter(Boolean));
          if (uniqueProfs.size > 1) toast.info("Ticket grupal: se usará la operaria del selector principal.");
          return [{ service_ids: linesScheduled.map((l) => Number(l.service_id)), professional_id: groupProfId ? Number(groupProfId) : null, branch_id: activeBranchId, start_time: formatLocalDateTime(groupStart), end_time: formatLocalDateTime(groupEnd) }];
        }
        return linesScheduled.map((line) => {
          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end   = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
          return { service_id: Number(line.service_id), professional_id: line.professional_id ? Number(line.professional_id) : null, branch_id: activeBranchId, start_time: formatLocalDateTime(start), end_time: formatLocalDateTime(end) };
        });
      };

      const sale = await PosSaleService.create({
        ...(clientId ? { client_id: Number(clientId) } : {}), branch_id: activeBranchId,
        payment_method: mixedPayments.length > 0 ? "mixed" : paymentMethod,
        discount_type: discountType, discount_value: numericDiscount, notes: notes.trim() || undefined,
        items: buildItems(),
        product_items: productLines.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity })),
        ...(linkAppointmentId ? { link_appointment_id: linkAppointmentId } : {}),
        ...(mixedPayments.length > 0 ? { mixed_payments: mixedPayments } : {}),
      });
      sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
      const ticketCodes = sale.appointments.map((a) => a.ticket_code).filter((c): c is string => Boolean(c));
      const productSummary = sale.product_lines.length > 0
        ? `Productos: ${sale.product_lines.map((p) => `${p.product?.name ?? "Producto"} x${p.quantity}`).join(", ")}`
        : "";
      toast.success(
        ticketCodes.length > 0 ? `Venta completada. Tickets: ${ticketCodes.join(", ")}`
        : linkAppointmentId ? "Venta completada. Reserva cobrada en agenda."
        : productSummary ? `Venta completada. ${productSummary}`
        : "Venta completada. Tickets creados en agenda."
      );
      setLinkAppointmentId(null); setReceiptSale(sale); resetSaleForm();
      await loadContext();
      if (!embedded) navigate("/admin/pos/history");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : getApiErrorMessage(error, "Error en la venta."));
    } finally { setIsSubmitting(false); }
  };

  // ── Receipt editing ───────────────────────────────────────────────────────

  const saveSingleReceiptTicketEdit = async (appointmentId: number, edit: ReceiptTicketEdit) => {
    if (!receiptSale) return;
    const appointment = receiptSale.appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;
    if (edit.status === "in_service" && !edit.professional_id) {
      toast.warning("Para poner 'En atencion' debes seleccionar una operaria."); return;
    }
    try {
      const safeDate = edit.date || getLocalDateInputValue();
      const safeTime = edit.without_time ? "09:00" : (edit.time || "09:00");
      const start = new Date(`${safeDate}T${safeTime}:00`);
      const currentStartMs = new Date(appointment.start_time).getTime();
      const currentEndMs   = new Date(appointment.end_time).getTime();
      const durationMs     = Number.isFinite(currentStartMs) && Number.isFinite(currentEndMs)
        ? Math.max(60_000, currentEndMs - currentStartMs) : 60 * 60 * 1000;
      const end = new Date(start.getTime() + durationMs);
      const updated = await AgendaService.updateAppointment(appointment.id, {
        start_time: formatLocalDateTime(start), end_time: formatLocalDateTime(end),
        professional_id: edit.professional_id ? Number(edit.professional_id) : null,
        status: edit.status, skip_availability_check: true,
      });
      const prof = edit.professional_id ? professionals.find((p) => String(p.id) === edit.professional_id) : undefined;
      setReceiptSale((prev) => {
        if (!prev) return prev;
        return { ...prev, appointments: prev.appointments.map((a) =>
          a.id !== appointment.id ? a : { ...a, start_time: updated.start_time, end_time: updated.end_time, status: updated.status,
            professional: prof ? { id: prof.id, username: prof.username } : null }
        )};
      });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar este ticket."));
    }
  };

  const updateReceiptTicketEdit = (appointmentId: number, patch: Partial<ReceiptTicketEdit>) => {
    const current = receiptTicketEdits[appointmentId];
    if (!current) return;
    const nextEdit: ReceiptTicketEdit = { ...current, ...patch };
    setReceiptTicketEdits((prev) => ({ ...prev, [appointmentId]: nextEdit }));
    void saveSingleReceiptTicketEdit(appointmentId, nextEdit);
  };

  const saveReceiptTicketEdits = async () => {
    if (!receiptSale) return;
    setIsSavingReceiptTickets(true);
    try {
      const updatedAppointments = await Promise.all(
        receiptSale.appointments.map(async (appt) => {
          const edit = receiptTicketEdits[appt.id];
          if (!edit) return appt;
          const safeDate = edit.date || getLocalDateInputValue();
          const safeTime = edit.without_time ? "09:00" : (edit.time || "09:00");
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const currentStartMs = new Date(appt.start_time).getTime();
          const currentEndMs   = new Date(appt.end_time).getTime();
          const durationMs     = Number.isFinite(currentStartMs) && Number.isFinite(currentEndMs) ? Math.max(60_000, currentEndMs - currentStartMs) : 60 * 60 * 1000;
          const end = new Date(start.getTime() + durationMs);
          const nextProfId = edit.professional_id ? Number(edit.professional_id) : null;
          const nextStatus = edit.status === "in_service" ? "in_service" : "pending";
          const nextStart  = formatLocalDateTime(start);
          const nextEnd    = formatLocalDateTime(end);
          const hasChanges = nextStart !== formatLocalDateTime(new Date(appt.start_time)) || nextEnd !== formatLocalDateTime(new Date(appt.end_time)) || nextProfId !== (appt.professional?.id ?? null) || appt.status !== nextStatus;
          if (!hasChanges) return appt;
          const updated = await AgendaService.updateAppointment(appt.id, { start_time: nextStart, end_time: nextEnd, professional_id: nextProfId, status: nextStatus, skip_availability_check: true });
          const prof = edit.professional_id ? professionals.find((p) => String(p.id) === edit.professional_id) : undefined;
          return { ...appt, start_time: updated.start_time, end_time: updated.end_time, status: updated.status, professional: prof ? { id: prof.id, username: prof.username } : null };
        })
      );
      setReceiptSale((prev) => (prev ? { ...prev, appointments: updatedAppointments } : prev));
      toast.success("Tickets actualizados correctamente.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "No se pudieron actualizar los tickets."));
    } finally { setIsSavingReceiptTickets(false); }
  };

  const handleOpenPrintPreview = () => {
    if (!receiptSale) return;
    setPrintFormat("a4"); setIsPrintPreviewOpen(true);
  };

  // ── Client registration ───────────────────────────────────────────────────

  const handleRegisterClientSubmit = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const nombre   = String(fd.get("nombre") ?? "").trim();
    const apellido = String(fd.get("apellido") ?? "").trim();
    const edadRaw  = String(fd.get("edad") ?? "").trim();
    const phoneCC  = String(fd.get("phone_country_code") ?? "+591").trim();
    const phone    = String(fd.get("phone") ?? "").trim();
    const eyeRaw   = String(fd.get("eye_type_id") ?? "").trim();
    const branchRaw = String(fd.get("branch_id") ?? "").trim();
    if (!nombre || !apellido) { toast.warning("Nombre y apellido son obligatorios."); return; }
    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;
    if (edad !== undefined && (edad < 1 || edad > 100)) { toast.warning(edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100."); return; }
    const normalizedPhone = phone.replace(/\D/g, "");
    const parsedEyeTypeId = Number(eyeRaw);
    const eye_type_id = eyeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;
    const parsedBranchId = Number(branchRaw);
    let branch_id: number | undefined = branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;
    if (!branch_id && activeBranchId) branch_id = activeBranchId;
    try {
      const created = await ClientService.create({ name: nombre, last_name: apellido, age: edad, phone: normalizedPhone ? `${phoneCC}${normalizedPhone}` : undefined, eye_type_id, branch_id });
      setClientId(String(created.id));
      setClientSearch(`${created.nombre} ${created.apellido}`.trim());
      setClients((prev) => prev.some((c) => String(c.id) === String(created.id)) ? prev : [created, ...prev]);
      toast.success("Cliente registrado correctamente.");
      setIsRegisterClientOpen(false);
      void loadContext();
    } catch (err: unknown) {
      toast.error(typeof err === "object" && err !== null && "response" in err
        ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "No se pudo registrar el cliente.")
        : "No se pudo registrar el cliente.");
    }
  };

  // ── History handlers ──────────────────────────────────────────────────────

  const handleEditSaleFromHistory = async (sale: PosSaleItem) => {
    try {
      const saleForEdit = await PosSaleService.getById(sale.id);
      const nextLines: CartLine[] = saleForEdit.appointments.map((appt) => {
        const when  = toDateAndTimeInputValues(appt.start_time);
        const start = new Date(appt.start_time);
        const end   = new Date(appt.end_time);
        const durationMinutes = Math.max(1, Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? 60 : Math.round((end.getTime() - start.getTime()) / 60000));
        const serviceId = String(appt.service?.id ?? "");
        return {
          localId: `edit-sale-${saleForEdit.id}-appt-${appt.id}`, appointment_id: appt.id, service_id: serviceId,
          professional_id: appt.professional?.id ? String(appt.professional.id) : "",
          date: when.date || saleBaseDate, time: when.time || "09:00", without_time: when.without_time,
          status: appt.status === "in_service" ? "in_service" : "pending", duration_minutes: durationMinutes,
          price: services.find((s) => String(s.id) === serviceId)?.price ?? Number(appt.service?.price ?? 0),
        };
      });
      setEditingSale(saleForEdit);
      setClientId(String(saleForEdit.client.id));
      setClientSearch(`${saleForEdit.client?.name ?? ""} ${saleForEdit.client?.last_name ?? ""}`.trim());
      if (saleForEdit.client) {
        const c = saleForEdit.client;
        setClients((prev) => prev.some((x) => String(x.id) === String(c.id)) ? prev
          : [{ id: c.id, nombre: c.name ?? "", apellido: c.last_name ?? "", phone: c.phone ?? null, status: (c as { status?: string }).status ?? null }, ...prev]);
      }
      setPaymentMethod((saleForEdit.payment_method || "cash").toLowerCase());
      setDiscountType(saleForEdit.discount_type === "percent" ? "percent" : "amount");
      setDiscountValue(String(saleForEdit.discount_value ?? 0));
      setNotes(saleForEdit.notes ?? ""); setCartLines(nextLines);
      setServiceSearch(""); setSelectedServiceCategoryId("all");
      setAvailabilityPreviewLineId(null); setAvailabilityPreviewDate(""); setAvailabilitySearch("");
      setReceiptSale(null); setActiveTab("sale"); setStep(1);
      toast.success(`Editando venta ${saleForEdit.sale_code}.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar la venta para edicion."));
    }
  };

  const handleCancelSaleFromHistory = (sale: PosSaleItem) => {
    if (sale.status === "cancelled") { toast.info("Esta venta ya esta cancelada."); return; }
    setConfirmCancelSale(sale);
  };

  const executeCancelSale = async () => {
    if (!confirmCancelSale) return;
    setIsProcessingConfirm(true);
    try {
      const cancelled = await PosSaleService.cancel(confirmCancelSale.id);
      setSales((prev) => prev.map((s) => (s.id === cancelled.id ? cancelled : s)));
      if (receiptSale?.id === cancelled.id) setReceiptSale(cancelled);
      void loadContext(); toast.success("Venta cancelada correctamente."); setConfirmCancelSale(null);
    } catch (error) { toast.error(getApiErrorMessage(error, "No se pudo cancelar la venta.")); }
    finally { setIsProcessingConfirm(false); }
  };

  const handleDeleteSaleFromHistory = (sale: PosSaleItem) => setConfirmDeleteSale(sale);

  const executeDeleteSale = async () => {
    if (!confirmDeleteSale) return;
    setIsProcessingConfirm(true);
    try {
      await PosSaleService.remove(confirmDeleteSale.id);
      setSales((prev) => prev.filter((s) => s.id !== confirmDeleteSale.id));
      if (receiptSale?.id === confirmDeleteSale.id) setReceiptSale(null);
      void loadContext(); toast.success("Venta eliminada correctamente."); setConfirmDeleteSale(null);
    } catch (error) { toast.error(getApiErrorMessage(error, "No se pudo eliminar la venta.")); }
    finally { setIsProcessingConfirm(false); }
  };

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    activeTab, setActiveTab, step, setStep,
    clients, services, serviceCategories, professionals, sales, products, existingTickets, eyeTypes, branches,
    eyeTypesError, isLoadingEyeTypes, isLoading,
    activeBranchId, setActiveBranchId,
    clientId, setClientId, clientSearch, setClientSearch,
    paymentMethod, setPaymentMethod, mixedPayments, setMixedPayments,
    discountType, setDiscountType, discountValue, setDiscountValue,
    notes, setNotes, cartLines, productLines, serviceSearch, setServiceSearch,
    selectedServiceCategoryId, setSelectedServiceCategoryId, sellerId, setSellerId,
    ticketMode, setTicketMode, linkAppointmentId,
    isSubmitting, receiptSale, setReceiptSale, editingSale,
    confirmCancelSale, setConfirmCancelSale, confirmDeleteSale, setConfirmDeleteSale, isProcessingConfirm,
    isRegisterClientOpen, setIsRegisterClientOpen, isClientMenuOpen, setIsClientMenuOpen,
    isCartOpen, setIsCartOpen, isServiceMenuOpen, setIsServiceMenuOpen, serviceMenuPosition,
    isCategoryModalOpen, setIsCategoryModalOpen, categoryModalSearch, setCategoryModalSearch,
    categoryModalFilterId, setCategoryModalFilterId,
    availabilityPreviewLineId, setAvailabilityPreviewLineId, availabilityPreviewDate, setAvailabilityPreviewDate,
    availabilitySearch, setAvailabilitySearch,
    isPrintPreviewOpen, setIsPrintPreviewOpen, receiptTicketEdits, isSavingReceiptTickets,
    printFormat, setPrintFormat,
    historySearch, setHistorySearch, historyClientFilter, setHistoryClientFilter,
    historyPaymentFilter, setHistoryPaymentFilter, historyDateFrom, setHistoryDateFrom,
    historyDateTo, setHistoryDateTo, colFilters, setColFilters,
    rowsPerPage, setRowsPerPage, currentPage, setCurrentPage,
    saleBaseDate, numericDiscount, selectedClient, clientPhone, clientAddress,
    filteredClients, filteredServices, subtotal, discountAmount, total, quickServices,
    categoryModalSelectionCounts, filteredModalServices, historyClientOptions, historyPaymentOptions,
    filteredSales, filteredSalesTotalAmount, allSalesTotalAmount, totalPages, pagedSales,
    lineAvailability, checkoutTicketPreviews, activeAvailabilityLine, occupiedTicketsForPreview, previewHourSlots,
    qrRef, clientComboboxRef, serviceComboboxRef, serviceMenuRef,
    updateServiceMenuPosition, addServiceToCart, removeLastCartLineForService, removeLine, updateLine,
    addProductToCart, updateProductQuantity, removeProductLine,
    handleUpdateTicketTime, resetSaleForm, handleServiceSelect, handleSelectHourFromPreview,
    handleImmediateCheckout, handleCheckout,
    updateReceiptTicketEdit, saveReceiptTicketEdits, handleOpenPrintPreview,
    handleRegisterClientSubmit, handleEditSaleFromHistory, handleCancelSaleFromHistory,
    executeCancelSale, handleDeleteSaleFromHistory, executeDeleteSale, loadEyeTypes,
    toDateAndTimeInputValues, formatHourMinute,
  };
}
