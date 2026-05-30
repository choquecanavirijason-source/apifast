import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Building2, CalendarDays, ShoppingCart } from "lucide-react";
import { toast } from "react-toastify";
import {
  AgendaService,
  deriveServiceCategoriesFromServices,
  type TicketItem,
  type ServiceCategoryOption,
  type ProfessionalForSelect,
  type ServiceOption,
} from "../../../core/services/agenda/agenda.service";
import type { ClientForSelect } from "../../../core/services/agenda/agenda.service";
import {
  PosSaleService,
  getApiErrorMessage,
  type PosSaleItem,
} from "../../../core/services/pos-sale/pos-sale.service";
import { ClientService } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import Layout from "../../../components/common/layout";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import RegisterClientModal from "../clients/RegisterClientModal";
import CategorySelectionModal from "./components/CategorySelectionModal";
import SalesHistoryTable from "./components/SalesHistoryTable";
import PosSaleStepOne from "./components/PosSaleStepOne";
import PosSaleStepTwo from "./components/PosSaleStepTwo";
import PosReceiptModals from "./components/PosReceiptModals";
import { ROWS_PER_PAGE_OPTIONS } from "./pos.constants";
import type { CartLine, PosSaleDraft, ReceiptTicketEdit } from "./pos.types";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import type { RootState } from "../../../store";
const POS_DRAFT_STORAGE_KEY_PREFIX = "pos-sale-draft-v1";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getLocalDateInputValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getLocalTimeValue = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const formatLocalDateTime = (date: Date) => {
  const y  = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d  = String(date.getDate()).padStart(2, "0");
  const h  = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s  = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

const getPosDraftStorageKey = (branchId: number | null) =>
  `${POS_DRAFT_STORAGE_KEY_PREFIX}:${branchId ?? "global"}`;

const createLocalId = () => {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `local-${timePart}-${randomPart}`;
};

const isCartLine = (value: unknown): value is CartLine => {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  const statusIsValid =
    line.status === undefined || line.status === "pending" || line.status === "in_service";
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

const normalizeCartLine = (line: CartLine): CartLine => ({
  ...line,
  without_time: line.without_time ?? false,
  status: line.status === "in_service" ? "in_service" : "pending",
});

/** Fecha/hora reales al ejecutar el cobro: encadena desde ahora.
 *  Las líneas con time_manual === true conservan su hora editada por el usuario. */
const applySaleExecutionSchedule = (lines: CartLine[]): CartLine[] => {
  let cursor = Date.now();
  return lines.map((line) => {
    if (line.time_manual) {
      // Hora fijada manualmente: avanzar el cursor pero respetar la hora del usuario
      const durationMs = Math.max(Number(line.duration_minutes) || 60, 1) * 60 * 1000;
      cursor += durationMs;
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

/** Asigna vendedor/operaria del drawer a líneas que aún no tienen profesional. */
const applySellerToCartLines = (lines: CartLine[], sellerId: string): CartLine[] => {
  const trimmed = sellerId.trim();
  if (!trimmed) return lines;
  return lines.map((line) =>
    line.professional_id
      ? line
      : normalizeCartLine({ ...line, professional_id: trimmed })
  );
};

const prepareCartLinesForTicketCheckout = (
  lines: CartLine[],
  options: { sellerId: string; applySchedule: boolean }
): CartLine[] => {
  const withSeller = applySellerToCartLines(lines, options.sellerId);
  return options.applySchedule ? applySaleExecutionSchedule(withSeller) : withSeller;
};

const createDefaultLine = (service?: ServiceOption): CartLine => ({
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

const toDateAndTimeInputValues = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: getLocalDateInputValue(), time: "09:00", without_time: false };
  }

  const date = getLocalDateInputValue(parsed);
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  const without_time = time === "09:00";

  return { date, time, without_time };
};

const formatHourMinute = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

// ════════════════════════════════════════════════════════════════════════════
// PosPage
// ════════════════════════════════════════════════════════════════════════════

export type PosPageProps = {
  embedded?: boolean;
  initialDate?: string;
  section?: "sale" | "history" | "tickets";
  onCartCountChange?: (count: number) => void;
  onPendingPaymentCountChange?: (count: number) => void;
  cartDrawerSignal?: number;
  onRequestSwitchToPos?: () => void;
};

export default function PosPage({ embedded = false, initialDate, section, onCartCountChange, onPendingPaymentCountChange, cartDrawerSignal, onRequestSwitchToPos }: PosPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedUser = useSelector((state: RootState) => state.auth.user);

  const [activeTab, setActiveTab] = useState<"sale" | "history">(
    section === "history" ? "history" : "sale"
  );
  // Nuevo: estado para el paso del wizard
  const [step, setStep] = useState<1 | 2>(1);

  // Data
  const [clients,      setClients]      = useState<ClientForSelect[]>([]);
  const [services,     setServices]     = useState<ServiceOption[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryOption[]>([]);
  const [professionals,setProfessionals]= useState<ProfessionalForSelect[]>([]);
  const [sales,        setSales]        = useState<PosSaleItem[]>([]);
  const [existingTickets, setExistingTickets] = useState<TicketItem[]>([]);
  const [eyeTypes,     setEyeTypes]     = useState<EyeTypeOption[]>([]);
  const [branches,     setBranches]     = useState<
    Array<{
      id: number;
      name: string;
      opening_hours?: Array<{ day: string; ranges: Array<{ open_time: string; close_time: string }> }> | null;
    }>
  >([]);
  const [eyeTypesError,setEyeTypesError]= useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);

  // Sale form
  const [clientId,         setClientId]         = useState("");
  const [clientSearch,     setClientSearch]     = useState("");
  const [paymentMethod,    setPaymentMethod]     = useState("");
  const [discountType,     setDiscountType]      = useState<"amount" | "percent">("amount");
  const [discountValue,    setDiscountValue]     = useState("0");
  const [notes,            setNotes]             = useState("");
  const [cartLines,        setCartLines]         = useState<CartLine[]>([]);
  const [serviceSearch,    setServiceSearch]     = useState("");
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState("all");
  const [sellerId,         setSellerId]          = useState("");
  /** Modo de emisión de tickets: un ticket por servicio, o todos en un solo ticket grupal. */
  const [ticketMode, setTicketMode] = useState<"individual" | "group">("individual");

  // UI
  const [isSubmitting,        setIsSubmitting]        = useState(false);
  const [isLoading,           setIsLoading]           = useState(false);
  const [receiptSale,         setReceiptSale]         = useState<PosSaleItem | null>(null);
  const [editingSale,         setEditingSale]         = useState<PosSaleItem | null>(null);
  const [confirmCancelSale,   setConfirmCancelSale]   = useState<PosSaleItem | null>(null);
  const [confirmDeleteSale,   setConfirmDeleteSale]   = useState<PosSaleItem | null>(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);
  const [isRegisterClientOpen,setIsRegisterClientOpen]= useState(false);
  const [isClientMenuOpen,    setIsClientMenuOpen]    = useState(false);
  const [isServiceMenuOpen,   setIsServiceMenuOpen]   = useState(false);
  const [serviceMenuPosition, setServiceMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalSearch, setCategoryModalSearch] = useState("");
  const [categoryModalFilterId, setCategoryModalFilterId] = useState("all");
  const [availabilityPreviewLineId, setAvailabilityPreviewLineId] = useState<string | null>(null);
  const [availabilityPreviewDate, setAvailabilityPreviewDate] = useState("");
  const [availabilitySearch, setAvailabilitySearch] = useState("");
  const qrRef = useRef<HTMLDivElement | null>(null);
  const clientComboboxRef = useRef<HTMLDivElement | null>(null);
  const serviceComboboxRef = useRef<HTMLDivElement | null>(null);
  const serviceMenuRef = useRef<HTMLDivElement | null>(null);

  // Branch
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());

  // History filters & pagination
  const [historySearch, setHistorySearch] = useState("");
  const [historyClientFilter, setHistoryClientFilter] = useState("");
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState("all");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [colFilters, setColFilters] = useState({ sale_code: "", client: "", payment_method: "", total: "" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  /** Cobrar una reserva ya existente (desde agenda) sin duplicar la cita. */
  const [linkAppointmentId, setLinkAppointmentId] = useState<number | null>(null);
  const agendaHydrateDoneRef = useRef<number | null>(null);

  const saleBaseDate = initialDate || getLocalDateInputValue();

  // Derived
  const selectedClient = clients.find((c) => String(c.id) === clientId) ?? null;
  const clientPhone    = selectedClient?.phone?.trim() ?? "";
  const clientAddress  = selectedClient ? `Calle ${selectedClient.id} #${String(selectedClient.id).padStart(2, "0")}` : "";

  // Todos los clientes son seleccionables — los activos se muestran con indicador
  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const normalizedTermDigits = term.replace(/\D/g, "");

    const base = term
      ? clients.filter((client) => {
          const fullName = `${client.nombre} ${client.apellido}`.toLowerCase();
          const phone    = (client.phone ?? "").toLowerCase();
          const phoneDigits = phone.replace(/\D/g, "");
          return (
            fullName.includes(term) ||
            (Boolean(phone) && phone.includes(term)) ||
            (Boolean(normalizedTermDigits) && phone.replace(/\D/g, "").includes(normalizedTermDigits))
          );
        })
      : clients;

    // El cliente actualmente seleccionado siempre aparece primero aunque no esté en la lista
    const selectedInList = base.some((c) => String(c.id) === clientId);
    const selected = selectedClient && !selectedInList ? [selectedClient as typeof clients[0]] : [];
    return [...selected, ...base];
  }, [clients, clientSearch, clientId, selectedClient]);

  const filteredServices = useMemo(() => {
    const categoryFiltered = selectedServiceCategoryId === "all"
      ? services
      : services.filter((service) => {
        const serviceCategoryId = service.category_id ?? service.category?.id ?? null;
        return String(serviceCategoryId ?? "") === selectedServiceCategoryId;
      });

    const term = serviceSearch.trim().toLowerCase();
    if (!term) return categoryFiltered;

    return categoryFiltered.filter((service) => {
      const name = service.name.toLowerCase();
      const price = service.price.toFixed(2);
      return name.includes(term) || price.includes(term);
    });
  }, [services, serviceSearch, selectedServiceCategoryId]);

  const updateServiceMenuPosition = () => {
    if (!serviceComboboxRef.current) return;
    const rect = serviceComboboxRef.current.getBoundingClientRect();
    setServiceMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (clientComboboxRef.current && !clientComboboxRef.current.contains(event.target as Node)) {
        setIsClientMenuOpen(false);
      }

      const clickedInsideServiceInput = Boolean(
        serviceComboboxRef.current?.contains(event.target as Node)
      );
      const clickedInsideServiceMenu = Boolean(
        serviceMenuRef.current?.contains(event.target as Node)
      );

      if (!clickedInsideServiceInput && !clickedInsideServiceMenu) {
        setIsServiceMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!isServiceMenuOpen) return;

    const handleReposition = () => updateServiceMenuPosition();
    handleReposition();

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isServiceMenuOpen]);

  useEffect(() => {
    if (!isCategoryModalOpen) return;
    setCategoryModalFilterId(selectedServiceCategoryId || "all");
    setCategoryModalSearch("");
  }, [isCategoryModalOpen, selectedServiceCategoryId]);

  /** Conteos por servicio en el carrito (sincronizado con las líneas de venta mientras el modal está abierto). */
  const categoryModalSelectionCounts = useMemo(() => {
    if (!isCategoryModalOpen) return {};
    const counts: Record<string, number> = {};
    for (const line of cartLines) {
      const sid = line.service_id;
      if (!sid) continue;
      counts[sid] = (counts[sid] ?? 0) + 1;
    }
    return counts;
  }, [isCategoryModalOpen, cartLines]);

  const subtotal = useMemo(() => cartLines.reduce((s, l) => s + l.price, 0), [cartLines]);
  const numericDiscount = Number(discountValue) || 0;
  const discountAmount  = useMemo(
    () => (discountType === "percent" ? subtotal * (numericDiscount / 100) : numericDiscount),
    [discountType, numericDiscount, subtotal]
  );
  const total         = Math.max(0, subtotal - discountAmount);
  const quickServices = useMemo(() => filteredServices.slice(0, 12), [filteredServices]);

  const checkoutTicketPreviews = useMemo(() => {
    if (cartLines.length === 0 || linkAppointmentId) return [];
    const withSeller = applySellerToCartLines(cartLines, sellerId);

    if (ticketMode === "group" && withSeller.length > 1) {
      const firstLine = withSeller[0];
      const totalDuration = withSeller.reduce((acc, l) => acc + (l.duration_minutes || 60), 0);
      // Respeta tiempo manual del primer ticket si está fijado
      let start: Date;
      if (firstLine.time_manual && firstLine.date && firstLine.time) {
        start = new Date(`${firstLine.date}T${firstLine.time}:00`);
        if (Number.isNaN(start.getTime())) start = new Date();
      } else {
        start = new Date();
      }
      const end = new Date(start.getTime() + totalDuration * 60 * 1000);
      const totalMins = totalDuration;
      const durationLabel = totalMins >= 60
        ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? ` ${totalMins % 60}min` : ""}`
        : `${totalMins}min`;
      const timeLabel = `${getLocalDateInputValue(start)} ${getLocalTimeValue(start)} – ${getLocalTimeValue(end)} (${durationLabel} total)`;
      const firstProfId = withSeller.find((l) => l.professional_id)?.professional_id;
      const professional = firstProfId ? professionals.find((p) => String(p.id) === firstProfId) : null;
      const serviceNames = withSeller.map((l) => services.find((s) => String(s.id) === l.service_id)?.name ?? "Servicio");
      return [
        {
          localId: firstLine.localId,
          serviceName: serviceNames.join(" + "),
          scheduleLabel: timeLabel,
          professionalName: professional?.username ?? "Sin operaria",
          status: "Pendiente" as const,
          date: firstLine.time_manual && firstLine.date ? firstLine.date : getLocalDateInputValue(start),
          time: firstLine.time_manual && firstLine.time ? firstLine.time : getLocalTimeValue(start),
          without_time: false,
        },
      ];
    }

    // Individual: respeta hora manual si está fijada; encadena desde ahora para las demás.
    let cursor = Date.now();
    return withSeller.map((line) => {
      const service = services.find((item) => String(item.id) === line.service_id);
      const professional = professionals.find((item) => String(item.id) === line.professional_id);
      const durationMs = Math.max(Number(line.duration_minutes) || 60, 1) * 60 * 1000;

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
      const timeLabel = line.without_time
        ? `${line.date} · sin hora fija · ${durLabel}`
        : `${getLocalDateInputValue(start)} ${getLocalTimeValue(start)} – ${getLocalTimeValue(end)} (${durLabel})`;
      return {
        localId: line.localId,
        serviceName: service?.name ?? "Servicio",
        scheduleLabel: timeLabel,
        professionalName: professional?.username ?? "Sin operaria",
        status: line.status === "in_service" ? "En atención" : ("Pendiente" as const),
        date: line.time_manual && line.date ? line.date : getLocalDateInputValue(start),
        time: line.time_manual && line.time ? line.time : getLocalTimeValue(start),
        without_time: line.without_time,
      };
    });
  }, [cartLines, sellerId, services, professionals, linkAppointmentId, ticketMode]);

  const filteredModalServices = useMemo(() => {
    const term = categoryModalSearch.trim().toLowerCase();
    const categoryFiltered = categoryModalFilterId === "all"
      ? services
      : services.filter((service) => {
          const serviceCategoryId = service.category_id ?? service.category?.id ?? null;
          return String(serviceCategoryId ?? "") === categoryModalFilterId;
        });

    if (!term) return categoryFiltered;

    return categoryFiltered.filter((service) => {
      const name = service.name.toLowerCase();
      const price = service.price.toFixed(2);
      return name.includes(term) || price.includes(term);
    });
  }, [services, categoryModalSearch, categoryModalFilterId]);

  const historyClientOptions = useMemo(() => {
    return Array.from(
      new Set(
        sales
          .map((sale) => `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`.trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  const historyPaymentOptions = useMemo(() => {
    return Array.from(
      new Set(
        sales
          .map((sale) => (sale.payment_method ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [sales]);

  // Filtered + paged history
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const clientName = `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`.toLowerCase();
      const paymentMethod = (sale.payment_method ?? "").trim().toLowerCase();
      const saleDate = String(sale.created_at ?? "").slice(0, 10);
      const globalMatch =
        !historySearch ||
        sale.sale_code.toLowerCase().includes(historySearch.toLowerCase()) ||
        clientName.includes(historySearch.toLowerCase()) ||
        String(sale.total).includes(historySearch);

      const topFiltersMatch =
        (!historyClientFilter || clientName.includes(historyClientFilter.toLowerCase())) &&
        (historyPaymentFilter === "all" || paymentMethod === historyPaymentFilter.toLowerCase()) &&
        (!historyDateFrom || saleDate >= historyDateFrom) &&
        (!historyDateTo || saleDate <= historyDateTo);

      const colMatch =
        (!colFilters.sale_code     || sale.sale_code.toLowerCase().includes(colFilters.sale_code.toLowerCase())) &&
        (!colFilters.client        || clientName.includes(colFilters.client.toLowerCase())) &&
        (!colFilters.payment_method|| paymentMethod.includes(colFilters.payment_method.toLowerCase())) &&
        (!colFilters.total         || String(sale.total).includes(colFilters.total));

      return globalMatch && topFiltersMatch && colMatch;
    });
  }, [sales, historySearch, historyClientFilter, historyPaymentFilter, historyDateFrom, historyDateTo, colFilters]);

  const filteredSalesTotalAmount = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    [filteredSales]
  );

  const allSalesTotalAmount = useMemo(
    () => sales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    [sales]
  );

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage));
  const pagedSales = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSales.slice(start, start + rowsPerPage);
  }, [filteredSales, currentPage, rowsPerPage]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadContext = async () => {
    setIsLoading(true);
    try {
      const branchFilter = activeBranchId ?? undefined;
      const settled = await Promise.allSettled([
        AgendaService.listClientsForSelect({ limit: 200, branch_id: branchFilter }),
        AgendaService.listServices({ limit: 200, branch_id: branchFilter }),
        AgendaService.listServiceCategories(),
        AgendaService.listProfessionalsForSelect({
          limit: 200,
          role_name: "Operaria",
          branch_id: branchFilter,
        }),
        PosSaleService.list({ limit: 100 }),
        AgendaService.listTickets({ limit: 500, branch_id: branchFilter }),
      ]);

      const labels = ["Clientes", "Servicios", "Categorias", "Profesionales", "Ventas", "Agenda"] as const;
      const failures: string[] = [];

      if (settled[0].status === "fulfilled") setClients(settled[0].value);
      else failures.push(`${labels[0]}: ${getApiErrorMessage(settled[0].reason, "Error al cargar clientes.")}`);

      if (settled[1].status === "fulfilled") setServices(settled[1].value);
      else failures.push(`${labels[1]}: ${getApiErrorMessage(settled[1].reason, "Error al cargar servicios.")}`);

      if (settled[2].status === "fulfilled") {
        setServiceCategories(settled[2].value);
      } else {
        const servicesData = settled[1].status === "fulfilled" ? settled[1].value : [];
        const derived = deriveServiceCategoriesFromServices(servicesData);
        if (derived.length > 0) {
          setServiceCategories(derived);
        } else {
          setServiceCategories([]);
          failures.push(`${labels[2]}: ${getApiErrorMessage(settled[2].reason, "Error al cargar categorias.")}`);
        }
      }

      if (settled[3].status === "fulfilled") setProfessionals(settled[3].value);
      else failures.push(`${labels[3]}: ${getApiErrorMessage(settled[3].reason, "Error al cargar profesionales.")}`);

      if (settled[4].status === "fulfilled") {
        const salesData = settled[4].value;
        const filtered = activeBranchId ? salesData.filter((s) => s.branch_id === activeBranchId) : salesData;
        setSales(filtered);
        // Ventas pendientes de cobro: status != "paid" y tienen appointments completados
        const pendingCount = filtered.filter(
          (s) => s.status !== "paid" && s.status !== "cancelled" &&
          s.appointments.some((a) => a.status === "completed")
        ).length;
        onPendingPaymentCountChange?.(pendingCount);
      } else {
        failures.push(`${labels[4]}: ${getApiErrorMessage(settled[4].reason, "Error al cargar ventas.")}`);
        setSales([]);
      }

      if (settled[5].status === "fulfilled") {
        setExistingTickets(settled[5].value);
      } else {
        failures.push(`${labels[5]}: ${getApiErrorMessage(settled[5].reason, "Error al cargar tickets de agenda.")}`);
        setExistingTickets([]);
      }

      if (failures.length > 0) {
        console.error("[POS] loadContext:", failures);
        const deduped = [...new Set(failures)];
        toast.error(deduped.length === 1 ? deduped[0] : `No se cargó todo: ${deduped.join(" · ")}`);
      }
    } catch (err: unknown) {
      console.error("[POS] loadContext inesperado:", err);
      toast.error(getApiErrorMessage(err, "No se pudieron cargar los datos."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadContext(); }, [activeBranchId]);

  // Siempre arrancar con el carrito vacío — borrar cualquier borrador guardado
  useEffect(() => {
    sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch((err) => {
        console.error("Error cargando sucursales:", err);
        setBranches([]);
      });
  }, []);

  useEffect(() => {
    setIsDraftHydrated(false);
    const draftKey = getPosDraftStorageKey(activeBranchId);

    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) {
        setIsDraftHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PosSaleDraft>;
      const parsedCartLines = Array.isArray(parsed.cartLines)
        ? parsed.cartLines.filter(isCartLine).map(normalizeCartLine)
        : [];

      setClientId(typeof parsed.clientId === "string" ? parsed.clientId : "");
      setClientSearch(typeof parsed.clientSearch === "string" ? parsed.clientSearch : "");
      setPaymentMethod(typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "");
      setDiscountType(parsed.discountType === "percent" ? "percent" : "amount");
      setDiscountValue(typeof parsed.discountValue === "string" ? parsed.discountValue : "0");
      setNotes(typeof parsed.notes === "string" ? parsed.notes : "");
      setCartLines(parsedCartLines);
      setServiceSearch(typeof parsed.serviceSearch === "string" ? parsed.serviceSearch : "");
      setSelectedServiceCategoryId(
        typeof parsed.selectedServiceCategoryId === "string" ? parsed.selectedServiceCategoryId : "all"
      );
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

        if (ticket.sale_id) {
          toast.warning("Esta reserva ya tiene una venta registrada.");
          agendaHydrateDoneRef.current = appointmentId;
          return;
        }

        const rawIds = ticket.service_ids?.filter((id) => id != null && Number(id) > 0).map(Number);
        const serviceIds =
          rawIds && rawIds.length > 0 ? rawIds : ticket.service_id ? [ticket.service_id] : [];

        if (serviceIds.length === 0) {
          toast.warning("La reserva no tiene servicios para cobrar.");
          agendaHydrateDoneRef.current = appointmentId;
          return;
        }

        const startMs = new Date(ticket.start_time).getTime();
        const endMs = new Date(ticket.end_time).getTime();
        const totalMs = Math.max(endMs - startMs, 60_000);
        const perMs = totalMs / serviceIds.length;

        const lines: CartLine[] = [];
        for (let i = 0; i < serviceIds.length; i += 1) {
          const svc = services.find((s) => s.id === serviceIds[i]);
          const segStart = new Date(startMs + i * perMs);
          const dt = toDateAndTimeInputValues(formatLocalDateTime(segStart));
          const prices = ticket.service_prices;
          const fallbackPrice =
            prices != null && prices[i] !== undefined ? prices[i] : ticket.service_price;
          lines.push(
            normalizeCartLine({
              localId: createLocalId(),
              appointment_id: appointmentId,
              service_id: String(serviceIds[i]),
              professional_id:
                ticket.professional_id != null ? String(ticket.professional_id) : "",
              date: dt.date,
              time: dt.time,
              without_time: dt.without_time,
              status: "pending",
              duration_minutes: Math.max(15, Math.round(perMs / 60_000)),
              price: svc?.price ?? fallbackPrice ?? 0,
            })
          );
        }

        agendaHydrateDoneRef.current = appointmentId;
        setClientId(String(ticket.client_id));
        setClientSearch("");
        setCartLines(lines);
        setLinkAppointmentId(appointmentId);
        setStep(1);
        toast.info("Reserva cargada: mismo día y hora de la agenda. Cobrá desde el carrito con «Finalizar venta».");
      } catch {
        toast.error("No se pudo cargar la reserva desde la agenda.");
        agendaHydrateDoneRef.current = appointmentId;
      } finally {
        if (!cancelled) {
          navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDraftHydrated, services, location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (sellerId || professionals.length === 0 || !loggedUser) return;

    const normalizedEmail = (loggedUser.email ?? "").trim().toLowerCase();
    const normalizedName = (loggedUser.name ?? loggedUser.full_name ?? "").trim().toLowerCase();

    const byId = professionals.find((professional) => Number(professional.id) === Number(loggedUser.id));
    const byEmail = normalizedEmail
      ? professionals.find((professional) => professional.email.trim().toLowerCase() === normalizedEmail)
      : undefined;
    const byUsername = normalizedName
      ? professionals.find((professional) => professional.username.trim().toLowerCase() === normalizedName)
      : undefined;

    const matchedProfessional = byId ?? byEmail ?? byUsername;
    if (matchedProfessional) {
      setSellerId(String(matchedProfessional.id));
    }
  }, [sellerId, professionals, loggedUser]);

  // Sanitize stale professional IDs from sessionStorage drafts after professionals load.
  // Prevents "La profesional indicada no existe" when DB was reset or re-seeded.
  const didSanitizeDraftRef = useRef(false);
  useEffect(() => {
    if (!isDraftHydrated || professionals.length === 0 || didSanitizeDraftRef.current) return;
    didSanitizeDraftRef.current = true;
    const validIds = new Set(professionals.map((p) => String(p.id)));
    setSellerId((current) => (current && !validIds.has(current) ? "" : current));
    setCartLines((prev) =>
      prev.map((line) =>
        line.professional_id && !validIds.has(line.professional_id)
          ? { ...line, professional_id: "" }
          : line
      )
    );
  }, [isDraftHydrated, professionals]);

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

  useEffect(() => {
    void loadEyeTypes();
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setActiveBranchId(getSelectedBranchId());
      setClientId(""); setClientSearch(""); setServiceSearch(""); setCartLines([]);
    };
    const onStorage = (e: StorageEvent) => { if (e.key === BRANCH_STORAGE_KEY) handleChange(); };
    window.addEventListener("storage",      onStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage",      onStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isDraftHydrated) return;

    const draftKey = getPosDraftStorageKey(activeBranchId);
    const isEmptyDraft =
      !clientId &&
      !clientSearch &&
      (!paymentMethod || paymentMethod === "cash") &&
      discountType === "amount" &&
      (discountValue === "" || discountValue === "0") &&
      !notes.trim() &&
      cartLines.length === 0 &&
      !serviceSearch &&
      selectedServiceCategoryId === "all" &&
      !sellerId;

    if (isEmptyDraft) {
      sessionStorage.removeItem(draftKey);
      return;
    }

    const draft: PosSaleDraft = {
      clientId,
      clientSearch,
      paymentMethod,
      discountType,
      discountValue,
      notes,
      cartLines,
      serviceSearch,
      selectedServiceCategoryId,
      sellerId,
    };

    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    isDraftHydrated,
    activeBranchId,
    clientId,
    clientSearch,
    paymentMethod,
    discountType,
    discountValue,
    notes,
    cartLines,
    serviceSearch,
    selectedServiceCategoryId,
    sellerId,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [historySearch, historyClientFilter, historyPaymentFilter, historyDateFrom, historyDateTo, colFilters, rowsPerPage]);

  useEffect(() => {
    if (section) {
      setActiveTab(section);
    }
  }, [section]);

  useEffect(() => {
    onCartCountChange?.(cartLines.length);
  }, [cartLines.length, onCartCountChange]);

  useEffect(() => {
    if (!cartDrawerSignal) return;
    setActiveTab("sale");
    setStep(1);
    setIsCartOpen(true);
  }, [cartDrawerSignal]);

  // ── Cart ──────────────────────────────────────────────────────────────────

  const addServiceToCart = (service: ServiceOption) =>
    setCartLines((prev) => [
      ...prev,
      {
        ...createDefaultLine(service),
        date: saleBaseDate,
        professional_id: sellerId.trim() || "",
      },
    ]);

  const removeLastCartLineForService = (serviceId: string) => {
    setCartLines((prev) => {
      const revIdx = [...prev].reverse().findIndex((l) => l.service_id === serviceId);
      if (revIdx === -1) return prev;
      const removeIdx = prev.length - 1 - revIdx;
      return prev.filter((_, i) => i !== removeIdx);
    });
  };

  const getLineDateRange = (line: CartLine) => {
    const safeDate = line.date?.trim() || saleBaseDate;
    const safeTime = line.without_time ? "09:00" : (line.time?.trim() || "09:00");
    const start = new Date(`${safeDate}T${safeTime}:00`);
    const end = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
    return { start, end };
  };

  const editingAppointmentIds = useMemo(() => {
    if (!editingSale) return new Set<number>();
    return new Set(editingSale.appointments.map((appointment) => appointment.id));
  }, [editingSale]);

  const lineAvailability = useMemo(() => {
    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
      aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();

    // Statuses que ya NO bloquean el horario (servicio terminado o anulado)
    const freeStatuses = new Set([
      "cancelled",
      "completed",
      "finalizado",
      "atendido",
      "done",
      "no_show",
    ]);

    const result: Record<string, { available: boolean; conflictCount: number }> = {};

    for (let index = 0; index < cartLines.length; index += 1) {
      const line = cartLines[index];

      // Sin operaria asignada → no hay conflicto posible
      if (!line.professional_id) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }

      const professionalId = Number(line.professional_id);
      if (!Number.isFinite(professionalId)) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }

      // Sin hora definida → no se puede calcular solapamiento, omitir
      if (line.without_time || !line.time?.trim()) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }

      const { start, end } = getLineDateRange(line);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        result[line.localId] = { available: false, conflictCount: 1 };
        continue;
      }

      let conflictCount = 0;

      // Conflictos con otros tickets del mismo carrito
      for (let i = 0; i < cartLines.length; i += 1) {
        if (i === index) continue;
        const other = cartLines[i];
        if (Number(other.professional_id) !== professionalId) continue;
        if (other.without_time || !other.time?.trim()) continue;

        const otherRange = getLineDateRange(other);
        if (overlaps(start, end, otherRange.start, otherRange.end)) {
          conflictCount += 1;
        }
      }

      // Conflictos con tickets ya existentes en agenda
      for (const ticket of existingTickets) {
        // Ignorar tickets terminados/anulados — ya no ocupan el horario
        if (freeStatuses.has(ticket.status ?? "")) continue;
        if (editingAppointmentIds.has(ticket.id)) continue;
        if (Number(ticket.professional_id) !== professionalId) continue;

        const ticketStart = new Date(ticket.start_time);
        const ticketEnd = new Date(ticket.end_time);
        if (
          !Number.isNaN(ticketStart.getTime()) &&
          !Number.isNaN(ticketEnd.getTime()) &&
          overlaps(start, end, ticketStart, ticketEnd)
        ) {
          conflictCount += 1;
        }
      }

      result[line.localId] = {
        available: conflictCount === 0,
        conflictCount,
      };
    }

    return result;
  }, [cartLines, editingAppointmentIds, existingTickets, saleBaseDate]);

  const activeAvailabilityLine = useMemo(
    () => cartLines.find((line) => line.localId === availabilityPreviewLineId) ?? null,
    [cartLines, availabilityPreviewLineId]
  );

  const occupiedTicketsForPreview = useMemo(() => {
    if (!activeAvailabilityLine) return [];

    const targetDate =
      availabilityPreviewDate.trim() || activeAvailabilityLine.date?.trim() || saleBaseDate;
    const term = availabilitySearch.trim().toLowerCase();

    const resolveProfessionalName = (ticket: TicketItem) => {
      const fromTicket = ticket.professional_name?.trim();
      if (fromTicket) return fromTicket;
      const fromCatalog = professionals.find((professional) => professional.id === ticket.professional_id)?.username;
      return fromCatalog ?? "Sin operaria";
    };

    const freeStatuses = new Set(["cancelled", "completed", "finalizado", "atendido", "done", "no_show"]);

    return existingTickets
      .filter((ticket) => {
        if (freeStatuses.has(ticket.status ?? "")) return false;
        if (ticket.start_time.slice(0, 10) !== targetDate) return false;

        if (!term) return true;

        const professionalName = resolveProfessionalName(ticket).toLowerCase();
        const clientName = (ticket.client_name ?? "").toLowerCase();
        const serviceName = `${ticket.service_name ?? ""} ${(ticket.service_names ?? []).join(" ")}`.toLowerCase();
        return professionalName.includes(term) || clientName.includes(term) || serviceName.includes(term);
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [
    activeAvailabilityLine,
    availabilityPreviewDate,
    availabilitySearch,
    existingTickets,
    professionals,
    saleBaseDate,
  ]);

  const previewHourSlots = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => {
      const hourLabel = `${String(hour).padStart(2, "0")}:00`;
      const hourPrefix = `${String(hour).padStart(2, "0")}:`;
      const hourTickets = occupiedTicketsForPreview.filter(
        (ticket) => formatHourMinute(ticket.start_time).startsWith(hourPrefix)
      );

      const entries = hourTickets.slice(0, 3).map((ticket) => {
        const professionalName =
          ticket.professional_name ??
          professionals.find((professional) => professional.id === ticket.professional_id)?.username ??
          "Sin operaria";
        const clientName = ticket.client_name ?? "Sin cliente";
        const serviceName =
          (ticket.service_name ?? (ticket.service_names ?? []).join(" · ")) || "Servicio";

        return {
          ticketId: ticket.id,
          professionalName,
          clientName,
          serviceName,
        };
      });

      return {
        hourLabel,
        isBusy: hourTickets.length > 0,
        count: hourTickets.length,
        entries,
        extraCount: Math.max(0, hourTickets.length - entries.length),
      };
    });
  }, [occupiedTicketsForPreview, professionals]);

  useEffect(() => {
    if (!availabilityPreviewLineId) return;
    const exists = cartLines.some((line) => line.localId === availabilityPreviewLineId);
    if (!exists) {
      setAvailabilityPreviewLineId(null);
      setAvailabilityPreviewDate("");
      setAvailabilitySearch("");
    }
  }, [availabilityPreviewLineId, cartLines]);

  const handleSelectHourFromPreview = (hourValue: string) => {
    if (!availabilityPreviewLineId) return;

    const targetDate =
      availabilityPreviewDate.trim() || activeAvailabilityLine?.date?.trim() || saleBaseDate;

    updateLine(availabilityPreviewLineId, {
      date: targetDate,
      time: hourValue,
      without_time: false,
    });

    toast.success(`Horario ${hourValue} aplicado al ticket.`);
    setAvailabilityPreviewLineId(null);
  };

  const updateLine = (localId: string, patch: Partial<CartLine>) => {
    setCartLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;

        const nextLine: CartLine = { ...line, ...patch };

        // Si cambian el servicio, sincroniza precio y duración reales del catálogo.
        if (patch.service_id && patch.service_id !== line.service_id) {
          const selectedService = services.find((service) => String(service.id) === patch.service_id);
          if (selectedService) {
            nextLine.price = Number(selectedService.price ?? 0);
            nextLine.duration_minutes = Math.max(1, Number(selectedService.duration_minutes ?? 60));
          }
        }

        return nextLine;
      })
    );
  };

  /** Edita fecha/hora de un ticket desde el panel lateral del POS. Marca time_manual=true. */
  const handleUpdateTicketTime = (localId: string, date: string, time: string) => {
    updateLine(localId, { date, time, without_time: false, time_manual: true });
  };

  useEffect(() => {
    if (services.length === 0) return;

    // Mantiene tickets sincronizados si el catálogo cambia (precios/duraciones).
    setCartLines((prev) =>
      prev.map((line) => {
        const selectedService = services.find((service) => String(service.id) === line.service_id);
        if (!selectedService) return line;

        const syncedPrice = Number(selectedService.price ?? line.price);
        const syncedDuration = Math.max(1, Number(selectedService.duration_minutes ?? line.duration_minutes));

        if (line.price === syncedPrice && line.duration_minutes === syncedDuration) {
          return line;
        }

        return {
          ...line,
          price: syncedPrice,
          duration_minutes: syncedDuration,
        };
      })
    );
  }, [services]);
  const removeLine        = (localId: string) => setCartLines((prev) => prev.filter((l) => l.localId !== localId));
  const resetSaleForm     = () => {
    setEditingSale(null);
    setLinkAppointmentId(null);
    agendaHydrateDoneRef.current = null;
    setClientId("");
    setClientSearch("");
    setServiceSearch("");
    setSelectedServiceCategoryId("all");
    setPaymentMethod("");
    setDiscountValue("0");
    setNotes("");
    setCartLines([]);
    setSellerId("");
    sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
    if (embedded) {
      setActiveTab("sale");
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    if (!serviceId) return;
    const service = services.find((s) => String(s.id) === serviceId);
    if (service) addServiceToCart(service);
    setServiceSearch("");
    setIsServiceMenuOpen(false);
  };

  useEffect(() => {
    if (!receiptSale) {
      setReceiptTicketEdits({});
      return;
    }

    const edits: Record<number, ReceiptTicketEdit> = {};
    receiptSale.appointments.forEach((appointment) => {
      const when = toDateAndTimeInputValues(appointment.start_time);
      edits[appointment.id] = {
        date: when.date,
        time: when.time,
        without_time: when.without_time,
        professional_id: appointment.professional?.id ? String(appointment.professional.id) : "",
        status: appointment.status === "in_service" ? "in_service" : "pending",
      };
    });

    setReceiptTicketEdits(edits);
  }, [receiptSale]);

  const updateReceiptTicketEdit = (appointmentId: number, patch: Partial<ReceiptTicketEdit>) => {
    const current = receiptTicketEdits[appointmentId];
    if (!current) return;

    const nextEdit: ReceiptTicketEdit = {
      ...current,
      ...patch,
    };

    setReceiptTicketEdits((prev) => ({
      ...prev,
      [appointmentId]: nextEdit,
    }));

    void saveSingleReceiptTicketEdit(appointmentId, nextEdit);
  };

  const saveSingleReceiptTicketEdit = async (appointmentId: number, edit: ReceiptTicketEdit) => {
    if (!receiptSale) return;

    const appointment = receiptSale.appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;

    if (edit.status === "in_service" && !edit.professional_id) {
      toast.warning("Para poner 'En atencion' debes seleccionar una operaria.");
      return;
    }

    try {
      const safeDate = edit.date || getLocalDateInputValue();
      const safeTime = edit.without_time ? "09:00" : (edit.time || "09:00");
      const start = new Date(`${safeDate}T${safeTime}:00`);

      const currentStartMs = new Date(appointment.start_time).getTime();
      const currentEndMs = new Date(appointment.end_time).getTime();
      const durationMs = Number.isFinite(currentStartMs) && Number.isFinite(currentEndMs)
        ? Math.max(60_000, currentEndMs - currentStartMs)
        : 60 * 60 * 1000;
      const end = new Date(start.getTime() + durationMs);

      const updated = await AgendaService.updateAppointment(appointment.id, {
        start_time: formatLocalDateTime(start),
        end_time: formatLocalDateTime(end),
        professional_id: edit.professional_id ? Number(edit.professional_id) : null,
        status: edit.status,
        skip_availability_check: true,
      });

      const selectedProfessional = edit.professional_id
        ? professionals.find((professional) => String(professional.id) === edit.professional_id)
        : undefined;

      setReceiptSale((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          appointments: prev.appointments.map((item) => {
            if (item.id !== appointment.id) return item;

            return {
              ...item,
              start_time: updated.start_time,
              end_time: updated.end_time,
              status: updated.status,
              professional: selectedProfessional
                ? { id: selectedProfessional.id, username: selectedProfessional.username }
                : null,
            };
          }),
        };
      });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar este ticket."));
    }
  };

  const saveReceiptTicketEdits = async () => {
    if (!receiptSale) return;

    setIsSavingReceiptTickets(true);
    try {
      const updatedAppointments = await Promise.all(
        receiptSale.appointments.map(async (appointment) => {
          const edit = receiptTicketEdits[appointment.id];
          if (!edit) return appointment;

          const safeDate = edit.date || getLocalDateInputValue();
          const safeTime = edit.without_time ? "09:00" : (edit.time || "09:00");
          const start = new Date(`${safeDate}T${safeTime}:00`);

          const currentStartMs = new Date(appointment.start_time).getTime();
          const currentEndMs = new Date(appointment.end_time).getTime();
          const durationMs = Number.isFinite(currentStartMs) && Number.isFinite(currentEndMs)
            ? Math.max(60_000, currentEndMs - currentStartMs)
            : 60 * 60 * 1000;
          const end = new Date(start.getTime() + durationMs);

          const nextProfessionalId = edit.professional_id ? Number(edit.professional_id) : null;
          const nextStatus = edit.status === "in_service" ? "in_service" : "pending";
          const nextStart = formatLocalDateTime(start);
          const nextEnd = formatLocalDateTime(end);
          const originalStart = formatLocalDateTime(new Date(appointment.start_time));
          const originalEnd = formatLocalDateTime(new Date(appointment.end_time));
          const originalProfessionalId = appointment.professional?.id ?? null;

          const hasChanges =
            nextStart !== originalStart ||
            nextEnd !== originalEnd ||
            nextProfessionalId !== originalProfessionalId ||
            appointment.status !== nextStatus;

          if (!hasChanges) return appointment;

          const updated = await AgendaService.updateAppointment(appointment.id, {
            start_time: nextStart,
            end_time: nextEnd,
            professional_id: nextProfessionalId,
            status: nextStatus,
            skip_availability_check: true,
          });

          const selectedProfessional =
            edit.professional_id
              ? professionals.find((professional) => String(professional.id) === edit.professional_id)
              : undefined;

          return {
            ...appointment,
            start_time: updated.start_time,
            end_time: updated.end_time,
            status: updated.status,
            professional: selectedProfessional
              ? { id: selectedProfessional.id, username: selectedProfessional.username }
              : null,
          };
        })
      );

      setReceiptSale((prev) => (prev ? { ...prev, appointments: updatedAppointments } : prev));
      toast.success("Tickets actualizados correctamente.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "No se pudieron actualizar los tickets."));
    } finally {
      setIsSavingReceiptTickets(false);
    }
  };

  // ── Turno inmediato (walk-in sin planificador) ────────────────────────────

  const handleImmediateCheckout = async (payLater: boolean) => {
    if (!activeBranchId) return toast.warning("Selecciona una sucursal.");
    if (!clientId)       return toast.warning("Selecciona una clienta.");
    if (cartLines.length === 0) return toast.warning("El carrito está vacío.");
    if (!payLater && !paymentMethod) return toast.warning("Selecciona un método de pago.");

    setIsSubmitting(true);
    try {
      let cursor = Date.now();
      const items = cartLines.map((line) => {
        const start = new Date(cursor);
        const duration = Math.max(15, line.duration_minutes || 60);
        const end = new Date(cursor + duration * 60_000);
        cursor = end.getTime();
        const profId = line.professional_id
          ? Number(line.professional_id)
          : sellerId ? Number(sellerId) : null;
        return {
          service_id: Number(line.service_id),
          professional_id: profId,
          branch_id: activeBranchId,
          start_time: formatLocalDateTime(start),
          end_time: formatLocalDateTime(end),
        };
      });

      const payload = {
        client_id: Number(clientId),
        branch_id: activeBranchId,
        payment_method: payLater ? "cash" : paymentMethod,
        discount_type: discountType,
        discount_value: numericDiscount,
        notes: notes.trim() || undefined,
        items,
        ...(payLater ? { reservation_only: true } : {}),
      };

      const sale = await PosSaleService.create(payload);
      const codes = sale.appointments.map((a) => a.ticket_code).filter(Boolean);
      toast.success(
        payLater
          ? `Turno creado. Tickets: ${codes.join(", ")} (cobrar al finalizar)`
          : `Venta completada. Tickets: ${codes.join(", ")}`
      );
      setReceiptSale(sale);
      resetSaleForm();
      await loadContext();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Error al crear el turno."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Checkout (planificador) ───────────────────────────────────────────────

  const handleCheckout = async () => {
    if (!activeBranchId) return toast.warning("Selecciona una sucursal para la venta.");
    if (!clientId)       return toast.warning("Selecciona un cliente.");
    if (cartLines.length === 0) return toast.warning("El carrito está vacío.");

    const missingInServiceProfessional = cartLines.some(
      (line) => line.status === "in_service" && !line.professional_id
    );
    if (missingInServiceProfessional) {
      return toast.warning("Si un ticket está 'En atencion', debes seleccionar operaria.");
    }

    if (numericDiscount > 0) {
      const appliedDiscount = discountType === "percent"
        ? subtotal * (numericDiscount / 100)
        : numericDiscount;
      if (appliedDiscount >= subtotal) {
        return toast.warning("El descuento no puede ser igual o mayor al subtotal de la venta.");
      }
    }

    const linesScheduledForAgenda = linkAppointmentId
      ? applySellerToCartLines(cartLines, sellerId)
      : prepareCartLinesForTicketCheckout(cartLines, {
          sellerId,
          applySchedule: true,
        });

    setIsSubmitting(true);
    try {
      if (editingSale) {
        const appointmentIdsSeen = new Set<number>();

        for (const line of cartLines) {
          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end = new Date(start.getTime() + line.duration_minutes * 60 * 1000);

          if (line.appointment_id) {
            appointmentIdsSeen.add(line.appointment_id);
            await AgendaService.updateAppointment(line.appointment_id, {
              client_id: Number(clientId),
              service_id: Number(line.service_id),
              professional_id: line.professional_id ? Number(line.professional_id) : null,
              branch_id: activeBranchId,
              start_time: formatLocalDateTime(start),
              end_time: formatLocalDateTime(end),
              status: line.status,
              skip_availability_check: true,
            });
          } else {
            await AgendaService.createAppointment({
              client_id: Number(clientId),
              service_id: Number(line.service_id),
              professional_id: line.professional_id ? Number(line.professional_id) : null,
              branch_id: activeBranchId,
              sale_id: editingSale.id,
              start_time: formatLocalDateTime(start),
              end_time: formatLocalDateTime(end),
              status: line.status,
            });
          }
        }

        await Promise.all(
          editingSale.appointments
            .filter((appointment) => !appointmentIdsSeen.has(appointment.id))
            .map((appointment) => AgendaService.deleteAppointment(appointment.id))
        );

        const updatedSale = await PosSaleService.update(editingSale.id, {
          client_id: Number(clientId),
          payment_method: paymentMethod,
          discount_type: discountType,
          discount_value: numericDiscount,
          notes: notes.trim() || "",
        });

        const refreshedSale = await PosSaleService.getById(updatedSale.id);
        setSales((prev) => prev.map((sale) => (sale.id === refreshedSale.id ? refreshedSale : sale)));
        setReceiptSale(refreshedSale);
        sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
        toast.success(`Venta ${refreshedSale.sale_code} actualizada.`);
        resetSaleForm();
        await loadContext();
        if (!embedded) {
          navigate("/admin/pos/history");
        }
        return;
      }

      // ── Construir items según el modo de tickets ────────────────────────────
      const buildItems = () => {
        if (ticketMode === "group" && linesScheduledForAgenda.length > 1) {
          // Ticket grupal: 1 cita con duración total = suma de todos los servicios.
          // Una sola operaria atiende el turno completo.
          const firstLine = linesScheduledForAgenda[0];
          const safeDate = firstLine.date?.trim() || getLocalDateInputValue();
          const safeTime = firstLine.without_time ? "09:00" : (firstLine.time?.trim() || getLocalTimeValue());
          const groupStart = new Date(`${safeDate}T${safeTime}:00`);
          const totalDuration = linesScheduledForAgenda.reduce(
            (acc, l) => acc + (l.duration_minutes || 60), 0
          );
          const groupEnd = new Date(groupStart.getTime() + totalDuration * 60 * 1000);

          // Prioridad de operaria: 1) sellerId del drawer, 2) primera línea con operaria
          const groupProfId =
            sellerId.trim() ||
            linesScheduledForAgenda.find((l) => l.professional_id)?.professional_id ||
            null;

          // Advertir si hay operarias distintas asignadas por línea (solo 1 puede atender el grupo)
          const uniqueProfs = new Set(linesScheduledForAgenda.map((l) => l.professional_id).filter(Boolean));
          if (uniqueProfs.size > 1) {
            toast.info("Ticket grupal: se usará la operaria del selector principal. Para operarias distintas por servicio, usa modo Individual.");
          }

          return [
            {
              service_ids: linesScheduledForAgenda.map((l) => Number(l.service_id)),
              professional_id: groupProfId ? Number(groupProfId) : null,
              branch_id: activeBranchId,
              start_time: formatLocalDateTime(groupStart),
              end_time: formatLocalDateTime(groupEnd),
            },
          ];
        }
        // Tickets individuales (por defecto)
        return linesScheduledForAgenda.map((line) => {
          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
          return {
            service_id: Number(line.service_id),
            professional_id: line.professional_id ? Number(line.professional_id) : null,
            branch_id: activeBranchId,
            start_time: formatLocalDateTime(start),
            end_time: formatLocalDateTime(end),
          };
        });
      };

      const payload = {
        client_id: Number(clientId),
        branch_id: activeBranchId,
        payment_method: paymentMethod,
        discount_type: discountType,
        discount_value: numericDiscount,
        notes: notes.trim() || undefined,
        items: buildItems(),
        ...(linkAppointmentId ? { link_appointment_id: linkAppointmentId } : {}),
      };

      // El backend ya crea los appointments con los datos correctos del planificador.
      // No se necesita un segundo loop de updateAppointment.
      const sale = await PosSaleService.create(payload);

      sessionStorage.removeItem(getPosDraftStorageKey(activeBranchId));
      const ticketCodes = sale.appointments
        .map((appointment) => appointment.ticket_code)
        .filter((code): code is string => Boolean(code));
      toast.success(
        ticketCodes.length > 0
          ? `Venta completada. Tickets: ${ticketCodes.join(", ")}`
          : linkAppointmentId
            ? "Venta completada. Reserva cobrada en agenda."
            : "Venta completada. Tickets creados en agenda."
      );
      setLinkAppointmentId(null);
      setReceiptSale(sale);
      resetSaleForm();
      await loadContext();
      if (!embedded) {
        navigate("/admin/pos/history");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : getApiErrorMessage(error, "Error en la venta.");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Print preview ─────────────────────────────────────────────────────────

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [receiptTicketEdits, setReceiptTicketEdits] = useState<Record<number, ReceiptTicketEdit>>({});
  const [isSavingReceiptTickets, setIsSavingReceiptTickets] = useState(false);
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal">("a4");

  const handleOpenPrintPreview = () => {
    if (!receiptSale) return;
    setPrintFormat("a4");
    setIsPrintPreviewOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Register client ───────────────────────────────────────────────────────

  const handleRegisterClientSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const edadRaw = String(formData.get("edad") ?? "").trim();
    const phoneCountryCode = String(formData.get("phone_country_code") ?? "+591").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const eyeTypeRaw = String(formData.get("eye_type_id") ?? "").trim();
    const branchRaw = String(formData.get("branch_id") ?? "").trim();

    if (!nombre || !apellido) {
      toast.warning("Nombre y apellido son obligatorios.");
      return;
    }

    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;
    if (edad !== undefined && (edad < 1 || edad > 100)) {
      toast.warning(edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const formattedPhone = normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : undefined;

    const parsedEyeTypeId = Number(eyeTypeRaw);
    const eye_type_id = eyeTypeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;

    const parsedBranchId = Number(branchRaw);
    let branch_id: number | undefined =
      branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;

    if (!branch_id && activeBranchId) {
      branch_id = activeBranchId;
    }

    try {
      const created = await ClientService.create({
        name: nombre,
        last_name: apellido,
        age: edad,
        phone: formattedPhone,
        eye_type_id,
        branch_id,
      });

      // Selecciona automáticamente el cliente recién creado en la venta actual.
      setClientId(String(created.id));
      setClientSearch(`${created.nombre} ${created.apellido}`.trim());
      setClients((prev) => {
        const exists = prev.some((client) => String(client.id) === String(created.id));
        return exists ? prev : [created, ...prev];
      });

      toast.success("Cliente registrado correctamente.");
      setIsRegisterClientOpen(false);
      void loadContext();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "No se pudo registrar el cliente.")
          : "No se pudo registrar el cliente.";
      toast.error(msg);
    }
  };

  const handleEditSaleFromHistory = async (sale: PosSaleItem) => {
    try {
      const saleForEdit = await PosSaleService.getById(sale.id);
    const saleClientName = `${saleForEdit.client?.name ?? ""} ${saleForEdit.client?.last_name ?? ""}`.trim();
    const nextLines: CartLine[] = saleForEdit.appointments.map((appointment) => {
      const when = toDateAndTimeInputValues(appointment.start_time);
      const start = new Date(appointment.start_time);
      const end = new Date(appointment.end_time);
      const durationMinutes = Math.max(
        1,
        Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
          ? 60
          : Math.round((end.getTime() - start.getTime()) / 60000)
      );
      const serviceId = String(appointment.service?.id ?? "");
      const serviceFromCatalog = services.find((serviceItem) => String(serviceItem.id) === serviceId);
      const fallbackPrice = Number(appointment.service?.price ?? 0);

      return {
        localId: `edit-sale-${saleForEdit.id}-appt-${appointment.id}`,
        appointment_id: appointment.id,
        service_id: serviceId,
        professional_id: appointment.professional?.id ? String(appointment.professional.id) : "",
        date: when.date || saleBaseDate,
        time: when.time || "09:00",
        without_time: when.without_time,
        status: appointment.status === "in_service" ? "in_service" : "pending",
        duration_minutes: durationMinutes,
        price: serviceFromCatalog?.price ?? fallbackPrice,
      };
    });

      setEditingSale(saleForEdit);
      setClientId(String(saleForEdit.client.id));
      setClientSearch(saleClientName || "");

      // Garantizar que el cliente de la venta esté en la lista aunque sea de otra sucursal
      if (saleForEdit.client) {
        const c = saleForEdit.client;
        setClients((prev) => {
          const exists = prev.some((x) => String(x.id) === String(c.id));
          if (exists) return prev;
          return [
            {
              id: c.id,
              nombre: c.name ?? "",
              apellido: c.last_name ?? "",
              phone: c.phone ?? null,
              status: (c as { status?: string }).status ?? null,
            },
            ...prev,
          ];
        });
      }
      setPaymentMethod((saleForEdit.payment_method || "cash").toLowerCase());
      setDiscountType(saleForEdit.discount_type === "percent" ? "percent" : "amount");
      setDiscountValue(String(saleForEdit.discount_value ?? 0));
      setNotes(saleForEdit.notes ?? "");
      setCartLines(nextLines);
      setServiceSearch("");
      setSelectedServiceCategoryId("all");
      setAvailabilityPreviewLineId(null);
      setAvailabilityPreviewDate("");
      setAvailabilitySearch("");
      setReceiptSale(null);
      setActiveTab("sale");
      setStep(1);
      toast.success(`Editando venta ${saleForEdit.sale_code}.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cargar la venta para edicion."));
    }
  };

  const handleCancelSaleFromHistory = (sale: PosSaleItem) => {
    if (sale.status === "cancelled") {
      toast.info("Esta venta ya esta cancelada.");
      return;
    }
    setConfirmCancelSale(sale);
  };

  const executeCancelSale = async () => {
    if (!confirmCancelSale) return;
    setIsProcessingConfirm(true);
    try {
      const cancelledSale = await PosSaleService.cancel(confirmCancelSale.id);
      setSales((prev) => prev.map((item) => (item.id === cancelledSale.id ? cancelledSale : item)));
      if (receiptSale?.id === cancelledSale.id) {
        setReceiptSale(cancelledSale);
      }
      void loadContext();
      toast.success("Venta cancelada correctamente.");
      setConfirmCancelSale(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cancelar la venta."));
    } finally {
      setIsProcessingConfirm(false);
    }
  };

  const handleDeleteSaleFromHistory = (sale: PosSaleItem) => {
    setConfirmDeleteSale(sale);
  };

  const executeDeleteSale = async () => {
    if (!confirmDeleteSale) return;
    setIsProcessingConfirm(true);
    try {
      await PosSaleService.remove(confirmDeleteSale.id);
      setSales((prev) => prev.filter((item) => item.id !== confirmDeleteSale.id));
      if (receiptSale?.id === confirmDeleteSale.id) {
        setReceiptSale(null);
      }
      void loadContext();
      toast.success("Venta eliminada correctamente.");
      setConfirmDeleteSale(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la venta."));
    } finally {
      setIsProcessingConfirm(false);
    }
  };

  const HistorySection = () => (
    <SalesHistoryTable
      historySearch={historySearch}
      onHistorySearchChange={setHistorySearch}
      historyClientFilter={historyClientFilter}
      onHistoryClientFilterChange={setHistoryClientFilter}
      historyClientOptions={historyClientOptions}
      historyPaymentFilter={historyPaymentFilter}
      onHistoryPaymentFilterChange={setHistoryPaymentFilter}
      historyPaymentOptions={historyPaymentOptions}
      historyDateFrom={historyDateFrom}
      onHistoryDateFromChange={setHistoryDateFrom}
      historyDateTo={historyDateTo}
      onHistoryDateToChange={setHistoryDateTo}
      filteredSalesTotalAmount={filteredSalesTotalAmount}
      allSalesTotalAmount={allSalesTotalAmount}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      onRowsPerPageChange={setRowsPerPage}
      colFilters={colFilters}
      onColFilterChange={(key, value) => setColFilters((prev) => ({ ...prev, [key]: value }))}
      pagedSales={pagedSales}
      currentPage={currentPage}
      totalPages={totalPages}
      filteredSalesCount={filteredSales.length}
      onPageChange={setCurrentPage}
      onViewDetail={setReceiptSale}
      onEditSale={(sale) => void handleEditSaleFromHistory(sale)}
      onCancelSale={(sale) => void handleCancelSaleFromHistory(sale)}
      onDeleteSale={(sale) => void handleDeleteSaleFromHistory(sale)}
      allFilteredSales={filteredSales}
    />
  );

  const renderSaleTicketsSection = (onBack: () => void) => (
    <PosSaleStepTwo
      branchOpeningHours={branches.find((branch) => branch.id === activeBranchId)?.opening_hours ?? null}
      
      cartLines={cartLines}
      existingTickets={existingTickets}
      services={services}
      clientDisplayName={
        selectedClient
          ? `${selectedClient.nombre} ${selectedClient.apellido}`.trim()
          : (clientSearch.trim() || "Sin cliente")
      }
      editingSaleCode={editingSale?.sale_code ?? null}
      subtotal={subtotal}
      total={total}
      onRemoveLine={removeLine}
      professionals={professionals}
      lineAvailability={lineAvailability}
      saleBaseDate={saleBaseDate}
      updateLine={updateLine}
      setAvailabilityPreviewLineId={setAvailabilityPreviewLineId}
      setAvailabilityPreviewDate={setAvailabilityPreviewDate}
      setAvailabilitySearch={setAvailabilitySearch}
      isSubmitting={isSubmitting}
      onCheckout={() => void handleCheckout()}
      onBack={onBack}
      onOpenSalesHistory={() => {
        setActiveTab("history");
        setStep(1);
      }}
      clientComboboxRef={clientComboboxRef}
      clientSearch={clientSearch}
      setClientSearch={setClientSearch}
      setClientId={setClientId}
      isClientMenuOpen={isClientMenuOpen}
      setIsClientMenuOpen={setIsClientMenuOpen}
      filteredClients={filteredClients}
      selectedClient={selectedClient}
      clientPhone={clientPhone}
      clientAddress={clientAddress}
      sellerId={sellerId}
      setSellerId={setSellerId}
      discountValue={discountValue}
      setDiscountValue={setDiscountValue}
      discountType={discountType}
      setDiscountType={setDiscountType}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      notes={notes}
      setNotes={setNotes}
      onOpenRegisterClient={() => setIsRegisterClientOpen(true)}
      onAddServiceToCart={addServiceToCart}
    />
  );

  return (
    <Layout
      title={
        embedded ? undefined : (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-tight text-[#323130]">Caja registradora</span>
              <span className="block text-[11px] leading-tight text-[#605e5c]">Punto de venta · Dynamics-style</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-sm border border-[#edebe9] bg-white px-3 py-1.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <CalendarDays className="h-4 w-4 text-[#0078d4]" />
              <span className="font-medium text-[#323130]">
                {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </span>
          </span>
        )
      }
      subtitle={undefined}
      pageClassName={
        embedded
          ? "!min-h-0 flex h-full flex-1 flex-col !bg-transparent !p-0 overflow-hidden"
          : "flex h-[100dvh] flex-col overflow-hidden bg-[#f3f2f1] !px-0 md:!px-0"
      }
      containerClassName={
        embedded
          ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent !p-0 max-w-none"
          : "border-0 bg-transparent shadow-none w-full max-w-none !rounded-none !p-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      }
      toolbar={
        <div className="mb-1 mt-1 flex w-full items-center justify-between">
          <div className="inline-flex  rounded-sm border border-[#edebe9] bg-[#faf9f8]  shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {(["sale", "history"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "sale") resetSaleForm();
                  setActiveTab(tab);
                  setStep(1);
                }}
                className={`rounded-sm px-5 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? "border border-[#edebe9] bg-white text-[#323130] shadow-sm"
                    : "text-[#605e5c] hover:bg-white/70 hover:text-[#323130]"
                }`}
              >
                {tab === "sale" ? "Nueva venta" : "Historial"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "sale" && step === 1 ? (
              <button
                type="button"
                onClick={() => setIsCartOpen((prev) => !prev)}
                title={isCartOpen ? "Cerrar carrito" : "Ver carrito de venta"}
                className={`relative flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isCartOpen
                    ? "border-[#0078d4] bg-[#deecf9] text-[#0050a0]"
                    : "border-[#8a8886] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {isCartOpen ? "Cerrar carrito" : "Ver carrito"}
                {cartLines.length > 0 ? (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${isCartOpen ? "bg-[#0078d4] text-white" : "bg-[#323130] text-white"}`}>
                    {cartLines.length}
                  </span>
                ) : null}
              </button>
            ) : null}
            {editingSale ? (
              <>
                <span className="rounded-sm border border-[#f5d7a1] bg-[#fff4ce] px-3 py-1 text-xs font-semibold text-[#8a6a1f]">
                  Editando venta: {editingSale.sale_code}
                </span>
                <button
                  type="button"
                  onClick={resetSaleForm}
                  className="rounded-sm border border-[#edebe9] bg-white px-3 py-1 text-xs font-semibold text-[#605e5c] hover:bg-[#f3f2f1]"
                >
                  Salir edicion
                </button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden pb-2 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer">
        {activeTab === "sale" && !activeBranchId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f2f1]">
              <Building2 className="h-8 w-8 text-[#a19f9d]" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-base font-semibold text-[#323130]">Selecciona una sucursal</p>
              <p className="mt-1.5 text-sm text-[#605e5c]">
                Para registrar una venta debes elegir una sucursal específica.
                Con <strong>«Todas»</strong> el sistema no puede asignar la venta.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-sm border border-[#f5d7a1] bg-[#fff4ce] px-4 py-2.5 text-xs font-semibold text-[#8a6a1f]">
              ↑ Usa el selector de sucursal en la barra superior
            </div>
          </div>
        ) : activeTab === "sale" ? (
          step === 1 ? (
            <PosSaleStepOne
              labelClass={labelClass}
              fieldClass={fieldClass}
              isLoading={isLoading}
              serviceSearch={serviceSearch}
              onServiceSearchChange={(value: string) => {
                setServiceSearch(value);
                updateServiceMenuPosition();
                setIsServiceMenuOpen(true);
              }}
              onServiceInputFocus={() => {
                updateServiceMenuPosition();
                setIsServiceMenuOpen(true);
              }}
              onToggleServiceMenu={() => {
                updateServiceMenuPosition();
                setIsServiceMenuOpen((current) => !current);
              }}
              isServiceMenuOpen={isServiceMenuOpen}
              serviceMenuPosition={serviceMenuPosition}
              filteredServices={filteredServices}
              onServiceSelect={handleServiceSelect}
              selectedServiceCategoryId={selectedServiceCategoryId}
              onCategoryFilterChange={(value: string) => {
                setSelectedServiceCategoryId(value);
                updateServiceMenuPosition();
                setIsServiceMenuOpen(true);
              }}
              serviceCategories={serviceCategories}
              onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
              quickServices={quickServices}
              onAddServiceToCart={addServiceToCart}
              serviceComboboxRef={serviceComboboxRef}
              serviceMenuRef={serviceMenuRef}
              cartLines={cartLines}
              services={services}
              subtotal={subtotal}
              total={total}
              onRemoveLine={removeLine}
              onUpdateLine={(localId, patch) => updateLine(localId, patch)}
              clientComboboxRef={clientComboboxRef}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              setClientId={setClientId}
              isClientMenuOpen={isClientMenuOpen}
              setIsClientMenuOpen={setIsClientMenuOpen}
              filteredClients={filteredClients}
              selectedClient={selectedClient}
              clientPhone={clientPhone}
              clientAddress={clientAddress}
              sellerId={sellerId}
              setSellerId={setSellerId}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              discountType={discountType}
              setDiscountType={setDiscountType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              notes={notes}
              setNotes={setNotes}
              onOpenRegisterClient={() => setIsRegisterClientOpen(true)}
              professionals={professionals}
              isCartOpen={isCartOpen}
              setIsCartOpen={setIsCartOpen}
              finalizeSaleLabel={linkAppointmentId ? "Cobrar reserva" : "Finalizar venta"}
              finalizeFooterHint={
                linkAppointmentId
                  ? "Se cobra y se cierra la reserva con su horario de agenda."
                  : ticketMode === "group"
                    ? "Se creará 1 ticket grupal con todos los servicios."
                    : "Se creará un ticket en agenda por cada servicio al finalizar."
              }
              linkAppointmentId={linkAppointmentId}
              ticketPreviews={checkoutTicketPreviews}
              onGoToScheduleStep={() => setStep(2)}
              onFinalizeSale={() => void handleCheckout()}
              onCreateImmediateTicket={(payLater) => void handleImmediateCheckout(payLater)}
              isSubmittingCheckout={isSubmitting}
              ticketMode={ticketMode}
              setTicketMode={setTicketMode}
              onUpdateTicketTime={handleUpdateTicketTime}
            />
          ) : (
            renderSaleTicketsSection(() => setStep(1))
          )
        ) : (
          <HistorySection />
        )}

        <PosReceiptModals
          receiptSale={receiptSale}
          onCloseReceipt={() => {
            setReceiptSale(null);
          }}
          receiptTicketEdits={receiptTicketEdits}
          professionals={professionals}
          onUpdateReceiptTicketEdit={updateReceiptTicketEdit}
          onSaveReceiptTicketEdits={() => void saveReceiptTicketEdits()}
          isSavingReceiptTickets={isSavingReceiptTickets}
          onOpenPrintPreview={handleOpenPrintPreview}
          isPrintPreviewOpen={isPrintPreviewOpen}
          onClosePrintPreview={() => setIsPrintPreviewOpen(false)}
          onPrint={handlePrint}
          printFormat={printFormat}
          setPrintFormat={setPrintFormat}
          qrRef={qrRef}
          availabilityPreviewLineId={availabilityPreviewLineId}
          availabilityPreviewDate={availabilityPreviewDate}
          saleBaseDate={saleBaseDate}
          activeAvailabilityLine={activeAvailabilityLine}
          setAvailabilityPreviewLineId={setAvailabilityPreviewLineId}
          setAvailabilityPreviewDate={setAvailabilityPreviewDate}
          setAvailabilitySearch={setAvailabilitySearch}
          availabilitySearch={availabilitySearch}
          occupiedTicketsForPreview={occupiedTicketsForPreview}
          previewHourSlots={previewHourSlots}
          onSelectHourFromPreview={handleSelectHourFromPreview}
          onCloseAvailabilityPreview={() => {
            setAvailabilityPreviewLineId(null);
            setAvailabilityPreviewDate("");
            setAvailabilitySearch("");
          }}
          formatHourMinute={formatHourMinute}
          toDateAndTimeInputValues={toDateAndTimeInputValues}
        />

        <ConfirmDialog
          isOpen={!!confirmCancelSale}
          title="Cancelar venta"
          message={`¿Cancelar la venta ${confirmCancelSale?.sale_code}? Esto cancelará también sus tickets y pagos.`}
          confirmText="Cancelar venta"
          cancelText="No, volver"
          variant="danger"
          onConfirm={() => void executeCancelSale()}
          onCancel={() => setConfirmCancelSale(null)}
          isProcessing={isProcessingConfirm}
        />

        <ConfirmDialog
          isOpen={!!confirmDeleteSale}
          title="Eliminar venta"
          message={`¿Eliminar definitivamente la venta ${confirmDeleteSale?.sale_code}? Esta acción borrará tickets y pagos asociados.`}
          confirmText="Eliminar"
          cancelText="No, volver"
          variant="danger"
          onConfirm={() => void executeDeleteSale()}
          onCancel={() => setConfirmDeleteSale(null)}
          isProcessing={isProcessingConfirm}
        />

        <RegisterClientModal
          isOpen={isRegisterClientOpen}
          onClose={() => setIsRegisterClientOpen(false)}
          onSubmit={handleRegisterClientSubmit}
          eyeTypes={eyeTypes}
          branches={branches}
          eyeTypesError={eyeTypesError}
          isLoadingEyeTypes={isLoadingEyeTypes}
          onRetryEyeTypes={() => void loadEyeTypes()}
          mode="create"
          initialClient={null}
          defaultBranchId={activeBranchId}
        />

        <CategorySelectionModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          fieldClass={fieldClass}
          serviceCategories={serviceCategories}
          categoryModalSearch={categoryModalSearch}
          onCategoryModalSearchChange={setCategoryModalSearch}
          categoryModalFilterId={categoryModalFilterId}
          onCategoryModalFilterChange={setCategoryModalFilterId}
          onClear={() => {
            setCategoryModalFilterId("all");
            setCategoryModalSearch("");
          }}
          filteredModalServices={filteredModalServices}
          selectionCounts={categoryModalSelectionCounts}
          servicesCatalog={services}
          onIncrementSelection={(serviceId) => {
            const service = services.find((item) => String(item.id) === serviceId);
            if (service) addServiceToCart(service);
          }}
          onDecrementSelection={removeLastCartLineForService}
        />
      </div>
    </Layout>
  );
}