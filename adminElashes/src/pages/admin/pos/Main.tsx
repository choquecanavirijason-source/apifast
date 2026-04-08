import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  ArrowRight,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "react-toastify";
import {
  AgendaService,
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
import GenericModal from "../../../components/common/modal/GenericModal";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import RegisterClientModal from "../clients/RegisterClientModal";
import CategorySelectionModal from "./components/CategorySelectionModal";
import SalesHistoryTable from "./components/SalesHistoryTable";
import ServiceSelectorCard from "./components/ServiceSelectorCard";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import type { RootState } from "../../../store";

// ─── Types ───────────────────────────────────────────────────────────────────

type CartLine = {
  localId: string;
  service_id: string;
  professional_id: string;
  date: string;
  time: string;
  without_time: boolean;
  status: "pending" | "in_service";
  duration_minutes: number;
  price: number;
};

type ReceiptTicketEdit = {
  date: string;
  time: string;
  without_time: boolean;
  professional_id: string;
  status: "pending" | "in_service";
};

type PosSaleDraft = {
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

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "cash",     label: "Efectivo",      icon: Banknote   },
  { value: "card",     label: "Tarjeta",        icon: CreditCard },
  { value: "transfer", label: "Transferencia",  icon: Wallet     },
  { value: "qr",       label: "QR",             icon: QrCode     },
];

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50];
const POS_DRAFT_STORAGE_KEY_PREFIX = "pos-sale-draft-v1";
const TICKET_STATUS_OPTIONS = [
  { value: "pending", label: "En espera" },
  { value: "in_service", label: "En atencion" },
] as const;

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
  section?: "sale" | "history";
};

export default function PosPage({ embedded = false, initialDate, section }: PosPageProps) {
  const navigate = useNavigate();
  const loggedUser = useSelector((state: RootState) => state.auth.user);
  const isSectionLocked = Boolean(section);

  const [activeTab, setActiveTab] = useState<"sale" | "history">(section ?? "sale");

  // Data
  const [clients,      setClients]      = useState<ClientForSelect[]>([]);
  const [services,     setServices]     = useState<ServiceOption[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryOption[]>([]);
  const [professionals,setProfessionals]= useState<ProfessionalForSelect[]>([]);
  const [sales,        setSales]        = useState<PosSaleItem[]>([]);
  const [existingTickets, setExistingTickets] = useState<TicketItem[]>([]);
  const [eyeTypes,     setEyeTypes]     = useState<EyeTypeOption[]>([]);
  const [branches,     setBranches]     = useState<Array<{ id: number; name: string }>>([]);
  const [eyeTypesError,setEyeTypesError]= useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);

  // Sale form
  const [clientId,         setClientId]         = useState("");
  const [clientSearch,     setClientSearch]     = useState("");
  const [paymentMethod,    setPaymentMethod]     = useState("cash");
  const [discountType,     setDiscountType]      = useState<"amount" | "percent">("amount");
  const [discountValue,    setDiscountValue]     = useState("0");
  const [notes,            setNotes]             = useState("");
  const [cartLines,        setCartLines]         = useState<CartLine[]>([]);
  const [serviceSearch,    setServiceSearch]     = useState("");
  const [selectedServiceCategoryId, setSelectedServiceCategoryId] = useState("all");
  const [sellerId,         setSellerId]          = useState("");

  // UI
  const [isSubmitting,        setIsSubmitting]        = useState(false);
  const [isLoading,           setIsLoading]           = useState(false);
  const [receiptSale,         setReceiptSale]         = useState<PosSaleItem | null>(null);
  const [isRegisterClientOpen,setIsRegisterClientOpen]= useState(false);
  const [isClientMenuOpen,    setIsClientMenuOpen]    = useState(false);
  const [isServiceMenuOpen,   setIsServiceMenuOpen]   = useState(false);
  const [serviceMenuPosition, setServiceMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalSearch, setCategoryModalSearch] = useState("");
  const [categoryModalFilterId, setCategoryModalFilterId] = useState("all");
  const [categoryModalSelectionCounts, setCategoryModalSelectionCounts] = useState<Record<string, number>>({});
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

  const saleBaseDate = initialDate || getLocalDateInputValue();

  // Derived
  const selectedClient = clients.find((c) => String(c.id) === clientId) ?? null;
  const clientPhone    = selectedClient?.phone?.trim() ?? "";
  const clientAddress  = selectedClient ? `Calle ${selectedClient.id} #${String(selectedClient.id).padStart(2, "0")}` : "";

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term) return clients;

    const normalizedTermDigits = term.replace(/\D/g, "");

    return clients.filter((client) => {
      const fullName = `${client.nombre} ${client.apellido}`.toLowerCase();
      const phone = (client.phone ?? "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");

      const byName = fullName.includes(term);
      const byPhoneText = Boolean(phone) && phone.includes(term);
      const byPhoneDigits = Boolean(normalizedTermDigits) && phoneDigits.includes(normalizedTermDigits);

      return byName || byPhoneText || byPhoneDigits;
    });
  }, [clients, clientSearch]);

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
    setCategoryModalSelectionCounts({});
  }, [isCategoryModalOpen, selectedServiceCategoryId]);

  const subtotal = useMemo(() => cartLines.reduce((s, l) => s + l.price, 0), [cartLines]);
  const numericDiscount = Number(discountValue) || 0;
  const discountAmount  = useMemo(
    () => (discountType === "percent" ? subtotal * (numericDiscount / 100) : numericDiscount),
    [discountType, numericDiscount, subtotal]
  );
  const total         = Math.max(0, subtotal - discountAmount);
  const quickServices = useMemo(() => filteredServices.slice(0, 12), [filteredServices]);

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
        AgendaService.listClientsForSelect({ limit: 1000 }),
        AgendaService.listServices({ limit: 200, branch_id: branchFilter }),
        AgendaService.listServiceCategories(),
        AgendaService.listProfessionalsForSelect({ limit: 200 }),
        PosSaleService.list({ limit: 100 }),
        AgendaService.listTickets({ limit: 500, branch_id: branchFilter }),
      ]);

      const labels = ["Clientes", "Servicios", "Categorias", "Profesionales", "Ventas", "Agenda"] as const;
      const failures: string[] = [];

      if (settled[0].status === "fulfilled") setClients(settled[0].value);
      else failures.push(`${labels[0]}: ${getApiErrorMessage(settled[0].reason, "Error al cargar clientes.")}`);

      if (settled[1].status === "fulfilled") setServices(settled[1].value);
      else failures.push(`${labels[1]}: ${getApiErrorMessage(settled[1].reason, "Error al cargar servicios.")}`);

      if (settled[2].status === "fulfilled") setServiceCategories(settled[2].value);
      else failures.push(`${labels[2]}: ${getApiErrorMessage(settled[2].reason, "Error al cargar categorias.")}`);

      if (settled[3].status === "fulfilled") setProfessionals(settled[3].value);
      else failures.push(`${labels[3]}: ${getApiErrorMessage(settled[3].reason, "Error al cargar profesionales.")}`);

      if (settled[4].status === "fulfilled") {
        const salesData = settled[4].value;
        setSales(activeBranchId ? salesData.filter((s) => s.branch_id === activeBranchId) : salesData);
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
      const raw = localStorage.getItem(draftKey);
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
      setPaymentMethod(typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : "cash");
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
      localStorage.removeItem(draftKey);
    } finally {
      setIsDraftHydrated(true);
    }
  }, [activeBranchId]);

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
      paymentMethod === "cash" &&
      discountType === "amount" &&
      (discountValue === "" || discountValue === "0") &&
      !notes.trim() &&
      cartLines.length === 0 &&
      !serviceSearch &&
      selectedServiceCategoryId === "all" &&
      !sellerId;

    if (isEmptyDraft) {
      localStorage.removeItem(draftKey);
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

    localStorage.setItem(draftKey, JSON.stringify(draft));
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

  // ── Cart ──────────────────────────────────────────────────────────────────

  const addServiceToCart = (service: ServiceOption) =>
    setCartLines((prev) => [...prev, { ...createDefaultLine(service), date: saleBaseDate }]);

  const getLineDateRange = (line: CartLine) => {
    const safeDate = line.date?.trim() || saleBaseDate;
    const safeTime = line.without_time ? "09:00" : (line.time?.trim() || "09:00");
    const start = new Date(`${safeDate}T${safeTime}:00`);
    const end = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
    return { start, end };
  };

  const lineAvailability = useMemo(() => {
    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
      aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();

    const result: Record<string, { available: boolean; conflictCount: number }> = {};

    for (let index = 0; index < cartLines.length; index += 1) {
      const line = cartLines[index];
      if (!line.professional_id) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }

      const professionalId = Number(line.professional_id);
      if (!Number.isFinite(professionalId)) {
        result[line.localId] = { available: true, conflictCount: 0 };
        continue;
      }

      const { start, end } = getLineDateRange(line);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        result[line.localId] = { available: false, conflictCount: 1 };
        continue;
      }

      let conflictCount = 0;

      for (let i = 0; i < cartLines.length; i += 1) {
        if (i === index) continue;
        const other = cartLines[i];
        if (Number(other.professional_id) !== professionalId) continue;

        const otherRange = getLineDateRange(other);
        if (overlaps(start, end, otherRange.start, otherRange.end)) {
          conflictCount += 1;
        }
      }

      for (const ticket of existingTickets) {
        if ((ticket.status ?? "") === "cancelled") continue;
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
  }, [cartLines, existingTickets, saleBaseDate]);

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

    return existingTickets
      .filter((ticket) => {
        if ((ticket.status ?? "") === "cancelled") return false;
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
    setCartLines((prev) => prev.map((line) => (line.localId === localId ? { ...line, ...patch } : line)));
  };
  const removeLine        = (localId: string) => setCartLines((prev) => prev.filter((l) => l.localId !== localId));
  const resetSaleForm     = () => {
    setClientId("");
    setClientSearch("");
    setServiceSearch("");
    setSelectedServiceCategoryId("all");
    setPaymentMethod("cash");
    setDiscountValue("0");
    setNotes("");
    setCartLines([]);
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

  // ── Checkout ──────────────────────────────────────────────────────────────

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

    const conflictingLines = cartLines.filter((line) => {
      if (!line.professional_id) return false;
      return lineAvailability[line.localId] && !lineAvailability[line.localId].available;
    });
    if (conflictingLines.length > 0) {
      return toast.warning("Hay operarias ocupadas en ese horario. Ajusta horario u operaria antes de confirmar.");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        client_id: Number(clientId),
        branch_id: activeBranchId,
        payment_method: paymentMethod,
        discount_type: discountType,
        discount_value: numericDiscount,
        notes: notes.trim() || undefined,
        items: cartLines.map((line) => {
          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end   = new Date(start.getTime() + line.duration_minutes * 60 * 1000);
          return {
            service_id:      Number(line.service_id),
            professional_id: line.professional_id ? Number(line.professional_id) : null,
            branch_id:       activeBranchId,
            start_time:      formatLocalDateTime(start),
            end_time:        formatLocalDateTime(end),
          };
        }),
      } as const;

      const sale = await PosSaleService.create(payload);

      const updatedAppointments = await Promise.all(
        sale.appointments.map(async (appointment, index) => {
          const line = cartLines[index];
          if (!line) return appointment;

          const safeDate = line.date?.trim() || getLocalDateInputValue();
          const safeTime = line.without_time ? "09:00" : (line.time?.trim() || getLocalTimeValue());
          const start = new Date(`${safeDate}T${safeTime}:00`);
          const end = new Date(start.getTime() + line.duration_minutes * 60 * 1000);

          const updated = await AgendaService.updateAppointment(appointment.id, {
            start_time: formatLocalDateTime(start),
            end_time: formatLocalDateTime(end),
            professional_id: line.professional_id ? Number(line.professional_id) : null,
            status: line.status,
          });

          const selectedProfessional =
            line.professional_id
              ? professionals.find((professional) => String(professional.id) === line.professional_id)
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

      const saleWithUpdatedAppointments = { ...sale, appointments: updatedAppointments };
      localStorage.removeItem(getPosDraftStorageKey(activeBranchId));
      toast.success("Venta completada.");
      setReceiptSale(saleWithUpdatedAppointments);
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

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const toolbar = embedded || isSectionLocked ? undefined : (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
      {(["sale", "history"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab === "sale" ? "Nueva Venta" : "Historial"}
        </button>
      ))}
    </div>
  );

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
    />
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <Layout
      title={embedded ? undefined : "Caja Registradora"}
      subtitle={embedded ? undefined : "Punto de venta rápido y gestión de servicios"}
      pageClassName={
        embedded
          ? "!min-h-0 flex flex-1 flex-col !bg-transparent !p-0 h-full"
          : "bg-[#f5f5f7]"
      }
      containerClassName={
        embedded
          ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-transparent !p-0 max-w-none"
          : "border-0 bg-transparent shadow-none max-w-[1520px]"
      }
      toolbar={toolbar}
    >
      <div className="pb-4 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer">
      {/* ══ SALE TAB ═════════════════════════════════════════════════════════ */}
      {activeTab === "sale" ? (
        <div
          className={`flex flex-col md:grid md:grid-cols-[1fr_380px] gap-6 items-start ${isLoading ? "pointer-events-none opacity-60" : ""}`}
          aria-busy={isLoading}
        >

          {/* LEFT */}
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nueva Venta</h2>
                <p className="text-xs text-slate-500 mt-0.5">Agrega servicios y confirma el pago</p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-600">
                  {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
                </span>
              </div>
            </div>

            <ServiceSelectorCard
              labelClass={labelClass}
              fieldClass={fieldClass}
              serviceSearch={serviceSearch}
              onServiceSearchChange={(value) => {
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
                setIsServiceMenuOpen((prev) => !prev);
              }}
              isServiceMenuOpen={isServiceMenuOpen}
              serviceMenuPosition={serviceMenuPosition}
              filteredServices={filteredServices}
              onServiceSelect={handleServiceSelect}
              selectedServiceCategoryId={selectedServiceCategoryId}
              onCategoryFilterChange={(value) => {
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
            />

            {/* Cart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">Carrito</span>
                  {cartLines.length > 0 && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      {cartLines.length}
                    </span>
                  )}
                </div>
                {cartLines.length > 0 && (
                  <span className="text-xs text-slate-400 font-medium">
                    Subtotal: <span className="text-slate-700 font-semibold">Bs {subtotal.toFixed(2)}</span>
                  </span>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {cartLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                      <ShoppingCart className="h-6 w-6 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-slate-500">Carrito vacío</p>
                      <p className="text-xs text-slate-400 mt-0.5">Selecciona un servicio para comenzar</p>
                    </div>
                  </div>
                ) : (
                  cartLines.map((line) => {
                    const service = services.find((s) => String(s.id) === line.service_id);
                    return (
                      <div key={line.localId} className="group px-5 py-3.5 transition hover:bg-slate-50/70">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            {service?.image_url ? (
                              <img
                                src={service.image_url}
                                alt={service?.name ?? "Servicio"}
                                className="h-10 w-10 rounded-lg object-cover border border-slate-200 flex-none"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{service?.name ?? "Servicio"}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">Configura horario y profesional para este ticket</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs font-semibold text-slate-900 block">Bs {line.price.toFixed(2)}</span>
                              <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mt-0.5">
                                <Clock className="h-3 w-3" />{line.duration_minutes}m
                              </div>
                            </div>
                            <button
                              onClick={() => removeLine(line.localId)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-100 hover:text-red-600"
                              title="Quitar ticket"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_96px]">
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
                            <div className="flex items-center gap-1.5">
                              <div className="group relative inline-flex">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAvailabilityPreviewLineId(line.localId);
                                    setAvailabilityPreviewDate((line.date || saleBaseDate).trim());
                                    setAvailabilitySearch("");
                                  }}
                                  aria-label="Ver reservas del día"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-gradient-to-b from-emerald-50 to-teal-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:from-emerald-100 hover:to-teal-100 hover:text-emerald-800"
                                >
                                  <CalendarDays className="h-3.5 w-3.5" />
                                </button>
                                <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                                  Ver reservas del día
                                </span>
                              </div>
                              <input
                                type="date"
                                value={line.date}
                                onChange={(e) => updateLine(line.localId, { date: e.target.value })}
                                onBlur={(e) => {
                                  if (!e.target.value) {
                                    updateLine(line.localId, { date: getLocalDateInputValue() });
                                  }
                                }}
                                className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                            </div>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={line.time}
                                onChange={(e) => updateLine(line.localId, { time: e.target.value })}
                                disabled={line.without_time}
                                className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                              <label className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={line.without_time}
                                  onChange={(e) =>
                                    updateLine(line.localId, {
                                      without_time: e.target.checked,
                                      time: e.target.checked ? "" : getLocalTimeValue(),
                                    })
                                  }
                                />
                                Sin hora
                              </label>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Atendera</p>
                            <select
                              value={line.professional_id}
                              onChange={(e) => updateLine(line.localId, { professional_id: e.target.value })}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                            >
                              <option value="">Seleccionar profesional...</option>
                              {professionals.map((professional) => (
                                <option key={professional.id} value={String(professional.id)}>
                                  {professional.username}
                                </option>
                              ))}
                            </select>
                            <p
                              className={`mt-1 text-[10px] font-medium ${
                                !line.professional_id
                                  ? "text-slate-400"
                                  : lineAvailability[line.localId]?.available
                                    ? "text-emerald-600"
                                    : "text-red-500"
                              }`}
                            >
                              {!line.professional_id
                                ? "Selecciona operaria para validar disponibilidad"
                                : lineAvailability[line.localId]?.available
                                  ? "Operaria disponible en este horario"
                                  : `Operaria ocupada (${lineAvailability[line.localId]?.conflictCount ?? 1} conflicto${
                                      (lineAvailability[line.localId]?.conflictCount ?? 1) > 1 ? "s" : ""
                                    })`}
                            </p>
                          </div>
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                            <select
                              value={line.status}
                              onChange={(e) =>
                                updateLine(line.localId, {
                                  status: e.target.value === "in_service" ? "in_service" : "pending",
                                })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                            >
                              {TICKET_STATUS_OPTIONS.map((statusOption) => (
                                <option key={statusOption.value} value={statusOption.value}>
                                  {statusOption.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="w-full md:sticky md:top-24">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">

              {/* Client */}
              <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <p className={labelClass}>Cliente</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="relative" ref={clientComboboxRef}>
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setClientId("");
                          setIsClientMenuOpen(true);
                        }}
                        onFocus={() => setIsClientMenuOpen(true)}
                        placeholder="Buscar por nombre, apellido o telefono..."
                        className={`${fieldClass} pl-10`}
                      />

                      <button
                        type="button"
                        onClick={() => setIsClientMenuOpen((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Mostrar clientes"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      {isClientMenuOpen && (
                        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                          <div className="max-h-56 overflow-y-auto py-1">
                            {filteredClients.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-slate-500">No se encontraron clientes.</p>
                            ) : (
                              filteredClients.map((c) => {
                                const fullName = `${c.nombre} ${c.apellido}`.trim();
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setClientId(String(c.id));
                                      setClientSearch(fullName);
                                      setIsClientMenuOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-slate-50"
                                  >
                                    <span className="truncate text-sm text-slate-700">{fullName}</span>
                                    <span className="ml-3 shrink-0 text-xs text-slate-400">{c.phone || "Sin telefono"}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* ✦ Botón nuevo cliente */}
                  <button
                    type="button"
                    onClick={() => setIsRegisterClientOpen(true)}
                    title="Registrar nuevo cliente"
                    className="h-10 w-10 flex-none flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {selectedClient && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Teléfono</p>
                      <p className="text-xs font-medium text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">{clientPhone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Dirección</p>
                      <p className="text-xs font-medium text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 truncate">{clientAddress}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seller */}
              <div className="px-5 py-4 border-b border-slate-100">
                <label className={labelClass}>Vendedor</label>
                <div className="relative">
                  <select
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    className={`${fieldClass} appearance-none cursor-pointer`}
                  >
                    <option value="">Seleccionar vendedor…</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.username}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Discount + payment + notes */}
              <div className="px-5 py-4 border-b border-slate-100 space-y-4">
                <div>
                  <label className={labelClass}>Descuento</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="number" min={0}
                        className={`${fieldClass} pl-10`}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="relative w-24">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                        className={`${fieldClass} appearance-none text-center cursor-pointer pr-7`}
                      >
                        <option value="amount">Bs</option>
                        <option value="percent">%</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Método de Pago</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setPaymentMethod(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 px-1 text-[11px] font-semibold transition-all ${
                          paymentMethod === value
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={`${fieldClass} resize-none`}
                    placeholder="Observaciones opcionales…"
                  />
                </div>
              </div>

              {/* Totals + CTA */}
              <div className="px-5 py-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-700">Bs {subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Descuento</span>
                      <span className="font-medium">− Bs {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                    <span className="text-sm font-bold text-slate-900">Total</span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">Bs {total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => void handleCheckout()}
                  disabled={isSubmitting || cartLines.length === 0}
                  className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold tracking-wide transition-all duration-200 ${
                    isSubmitting || cartLines.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 text-white shadow-md hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                  }`}
                >
                  {isSubmitting ? (
                    <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Procesando…</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" />Confirmar Venta<ArrowRight className="h-4 w-4 ml-auto" /></>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>

      ) : (
        <HistorySection />
      )}

      {/* ══ RECEIPT MODAL ════════════════════════════════════════════════════ */}
      <GenericModal
        isOpen={Boolean(receiptSale)}
        onClose={() => {
          setReceiptSale(null);
          setActiveTab(section ?? "sale");
        }}
        title="Comprobante de Pago"
      >
        {receiptSale && (
          <div className="space-y-5 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <ReceiptText className="h-7 w-7" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bs {receiptSale.total.toFixed(2)}</h2>
              <p className="text-sm text-slate-500">
                Venta <span className="font-mono font-semibold text-slate-700">{receiptSale.sale_code}</span> completada
              </p>
            </div>

            {receiptSale.payment_method === "qr" && (
              <div ref={qrRef} className="bg-white p-4 inline-block rounded-2xl border border-slate-100 shadow-sm">
                <QRCodeCanvas value={receiptSale.sale_code} size={180} />
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Tickets generados</h3>
              <div className="space-y-2">
                {receiptSale.appointments.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin tickets asociados.</p>
                ) : (
                  receiptSale.appointments.map((appointment) => {
                    const edit = receiptTicketEdits[appointment.id];

                    return (
                      <div key={appointment.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {appointment.ticket_code ?? `#${appointment.id}`}
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {appointment.status === "in_service" ? "En atencion" : "En espera"}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {(appointment.services ?? []).length > 0
                                ? (appointment.services ?? []).map((s: any) => s.name).join(" · ")
                                : appointment.service?.name ?? "Servicio"}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 flex-none">
                            <Clock className="h-3 w-3" />
                            {new Date(appointment.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {edit && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
                              <input
                                type="date"
                                value={edit.date}
                                onChange={(e) => updateReceiptTicketEdit(appointment.id, { date: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</p>
                              <input
                                type="time"
                                value={edit.time}
                                disabled={edit.without_time}
                                onChange={(e) => updateReceiptTicketEdit(appointment.id, { time: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                              <label className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={edit.without_time}
                                  onChange={(e) =>
                                    updateReceiptTicketEdit(appointment.id, {
                                      without_time: e.target.checked,
                                      time: e.target.checked ? "" : "09:00",
                                    })
                                  }
                                />
                                Sin hora
                              </label>
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Operaria</p>
                              <select
                                value={edit.professional_id}
                                onChange={(e) => updateReceiptTicketEdit(appointment.id, { professional_id: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              >
                                <option value="">Sin operaria</option>
                                {professionals.map((professional) => (
                                  <option key={professional.id} value={String(professional.id)}>
                                    {professional.username}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                              <select
                                value={edit.status}
                                onChange={(e) => {
                                  const nextStatus = e.target.value === "in_service" ? "in_service" : "pending";
                                  if (nextStatus === "in_service" && !edit.professional_id) {
                                    toast.warning("Para poner 'En atencion' debes seleccionar una operaria.");
                                    return;
                                  }
                                  updateReceiptTicketEdit(appointment.id, { status: nextStatus });
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              >
                                {TICKET_STATUS_OPTIONS.map((statusOption) => (
                                  <option key={statusOption.value} value={statusOption.value}>
                                    {statusOption.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {receiptSale.appointments.length > 0 && (
                <button
                  type="button"
                  onClick={() => void saveReceiptTicketEdits()}
                  disabled={isSavingReceiptTickets}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingReceiptTickets ? "Guardando cambios..." : "Guardar cambios de tickets"}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() => setReceiptSale(null)}
              >
                Cerrar
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={handleOpenPrintPreview}
              >
                <Printer className="h-4 w-4" />Imprimir ticket
              </button>
            </div>
          </div>
        )}
      </GenericModal>

      {/* ══ PRINT PREVIEW MODAL ══════════════════════════════════════════════ */}
      {isPrintPreviewOpen && receiptSale && (
        <>
          {/* @media print styles injected inline */}
          <style>{`
            @media print {
              @page {
                size: ${printFormat === "thermal" ? "80mm auto" : "A4 portrait"};
                margin: ${printFormat === "thermal" ? "4mm" : "12mm"};
              }

              html, body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              body > *:not(#print-ticket-portal) { display: none !important; }
              #print-ticket-portal { display: block !important; position: fixed; inset: 0; background: white; z-index: 99999; }
              #print-ticket-portal .no-print { display: none !important; }

              #print-ticket-card {
                margin: 0 auto !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                border: ${printFormat === "thermal" ? "0" : "1px solid #e2e8f0"} !important;
                max-width: ${printFormat === "thermal" ? "80mm" : "190mm"} !important;
                width: 100% !important;
              }
            }
          `}</style>

          {/* Overlay backdrop */}
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div
              id="print-ticket-portal"
              className={`relative bg-white shadow-2xl w-full overflow-hidden ${
                printFormat === "thermal" ? "max-w-sm rounded-2xl" : "max-w-2xl rounded-2xl"
              }`}
            >
              {/* Header bar */}
              <div className="no-print flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Vista previa del ticket</p>
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              {/* Print format selector */}
              <div className="no-print px-5 pt-3 pb-1 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Formato de impresión</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintFormat("a4")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      printFormat === "a4"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Hoja grande (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat("thermal")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      printFormat === "thermal"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Impresora térmica
                  </button>
                </div>
              </div>

              {/* Ticket body — this is what gets printed */}
              <div
                id="print-ticket-card"
                className={`font-mono text-slate-800 ${
                  printFormat === "thermal" ? "px-4 py-4 text-xs" : "px-8 py-7 text-sm"
                }`}
              >
                {/* Store header */}
                <div className="text-center mb-4">
                  <p className={`${printFormat === "thermal" ? "text-sm" : "text-lg"} font-bold tracking-widest uppercase`}>
                    Comprobante
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(receiptSale.created_at).toLocaleDateString("es-BO", {
                      day: "2-digit", month: "long", year: "numeric",
                    })}
                    {" · "}
                    {new Date(receiptSale.created_at).toLocaleTimeString("es-BO", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-300 my-3" />

                {/* Sale info */}
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Código venta</span>
                  <span className="font-bold text-emerald-600">{receiptSale.sale_code}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Cliente</span>
                  <span className="font-semibold">{receiptSale.client?.name} {receiptSale.client?.last_name}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Método de pago</span>
                  <span className="font-semibold capitalize">{receiptSale.payment_method}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-300 my-3" />

                {/* Tickets */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Servicios</p>
                <div className="space-y-2">
                  {receiptSale.appointments.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center">Sin tickets asociados.</p>
                  ) : (
                    receiptSale.appointments.map((appointment) => {
                      const edit = receiptTicketEdits[appointment.id];
                      const displayTime = (() => {
                        if (edit?.without_time) return "Sin hora";
                        if (edit?.time?.trim()) return edit.time;
                        const fallback = toDateAndTimeInputValues(appointment.start_time);
                        return fallback.without_time ? "Sin hora" : fallback.time;
                      })();
                      return (
                        <div key={appointment.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {appointment.ticket_code ?? `#${appointment.id}`}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {(appointment.services ?? []).length > 0
                                ? (appointment.services ?? []).map((s: any) => s.name).join(", ")
                                : appointment.service?.name ?? "Servicio"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {appointment.professional?.username ? `Operaria: ${appointment.professional.username}` : "Operaria: Sin asignar"}
                              {" · "}
                              {appointment.status === "in_service" ? "En atencion" : "En espera"}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-400 flex-none flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {displayTime}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-slate-300 my-3" />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">TOTAL</span>
                  <span className="text-xl font-black text-slate-900">Bs {receiptSale.total.toFixed(2)}</span>
                </div>

                {/* QR if applicable */}
                {receiptSale.payment_method === "qr" && (
                  <div ref={qrRef} className="flex justify-center mt-4">
                    <QRCodeCanvas value={receiptSale.sale_code} size={100} />
                  </div>
                )}

                {/* Footer */}
                <div className="border-t border-dashed border-slate-300 mt-4 pt-3 text-center">
                  <p className="text-[11px] text-slate-400">¡Gracias por su compra!</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="no-print flex gap-2 px-5 pb-5">
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / Guardar PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}

            {/* ══ REGISTER CLIENT MODAL ════════════════════════════════════════════ */}
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
          setCategoryModalSelectionCounts({});
        }}
        filteredModalServices={filteredModalServices}
        selectionCounts={categoryModalSelectionCounts}
        onIncrementSelection={(serviceId) => {
          const service = services.find((item) => String(item.id) === serviceId);
          if (service) {
            addServiceToCart(service);
          }

          setCategoryModalSelectionCounts((prev) => ({
            ...prev,
            [serviceId]: (prev[serviceId] ?? 0) + 1,
          }));
        }}
      />

      <GenericModal
        isOpen={Boolean(availabilityPreviewLineId)}
        onClose={() => {
          setAvailabilityPreviewLineId(null);
          setAvailabilityPreviewDate("");
        }}
        title={`Reservas del dia ${
          availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate
        }`}
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
            <input
              type="date"
              value={availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate}
              onChange={(e) => setAvailabilityPreviewDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
            />
          </div>

          <input
            type="text"
            value={availabilitySearch}
            onChange={(e) => setAvailabilitySearch(e.target.value)}
            placeholder="Buscar operaria, cliente o servicio"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
          />

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Horas disponibles y ocupadas
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {previewHourSlots.map((slot) => (
                <button
                  key={slot.hourLabel}
                  type="button"
                  onClick={() => void handleSelectHourFromPreview(slot.hourLabel)}
                  className={`rounded-lg border px-3 py-3 text-left text-xs transition ${
                    slot.isBusy
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold leading-none">{slot.hourLabel}</p>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
                      {slot.isBusy ? `${slot.count} ocupada(s)` : "Libre"}
                    </span>
                  </div>

                  {slot.isBusy && (
                    <div className="mt-2 space-y-1.5 rounded-md border border-rose-100 bg-white/70 p-2 text-[11px] text-slate-700">
                      {slot.entries.map((entry) => (
                        <div key={`${slot.hourLabel}-${entry.ticketId}`} className="rounded border border-slate-100 bg-white px-2 py-1">
                          <p className="truncate text-[10px] font-semibold text-rose-700">Ticket #{entry.ticketId}</p>
                          <p className="truncate"><span className="font-semibold">Operaria:</span> {entry.professionalName}</p>
                          <p className="truncate"><span className="font-semibold">Cliente:</span> {entry.clientName}</p>
                          <p className="truncate"><span className="font-semibold">Servicio:</span> {entry.serviceName}</p>
                        </div>
                      ))}

                      {slot.extraCount > 0 && (
                        <p className="text-[10px] font-semibold text-slate-500">
                          +{slot.extraCount} ticket(s) más en esta hora
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Al tocar una hora, se guarda directamente en el ticket seleccionado.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Reservas del dia
            </p>
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {occupiedTicketsForPreview.length === 0 ? (
                <p className="text-xs text-slate-400">No hay reservas ocupadas para ese día con este filtro.</p>
              ) : (
                occupiedTicketsForPreview.map((ticket) => {
                  const professionalName =
                    ticket.professional_name ??
                    professionals.find((professional) => professional.id === ticket.professional_id)?.username ??
                    "Sin operaria";

                  return (
                    <div
                      key={ticket.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">{professionalName}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {ticket.client_name} · {(ticket.service_name ?? (ticket.service_names ?? []).join(" · ")) || "Servicio"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatHourMinute(ticket.start_time)} - {formatHourMinute(ticket.end_time)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </GenericModal>
      </div>
    </Layout>
  );
}