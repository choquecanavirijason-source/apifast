import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Edit, Trash2, FileDown, Users, Star, ChevronUp, RefreshCw, X, ShoppingBag, History } from "lucide-react";
import { toast } from "react-toastify";
import type { IClient } from "../../../core/types/IClient";
import { ClientService, type EyeTypeOption } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import DataTable, { type DataTableAction, type DataTableColumn } from "../../../components/common/table/DataTable.tsx";
import Layout from "../../../components/common/layout";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import FilterActionBar from "../../../components/common/FilterActionBar";
import { Button, SectionCard, StatCard } from "../../../components/common/ui";
import RegisterClientModal from "./RegisterClientModal";
import ClientSalesHistoryModal from "./ClientSalesHistoryModal";
import { BRANCH_STORAGE_KEY, getSelectedBranchId, setSelectedBranchId } from "../../../core/utils/branch";
import { generateTablePdf } from "../../../core/utils/generateTablePdf";

const SEEDED_EYE_TYPES_FALLBACK: EyeTypeOption[] = [
  { id: -1, name: "Almendrado" },
  { id: -2, name: "Encapotado" },
  { id: -3, name: "Redondo" },
  { id: -4, name: "Rasgado" },
  { id: -5, name: "Asimétricos" },
];

export default function ClientListPage() {
  const [items, setItems] = useState<IClient[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "frequent">("all");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [eyeTypes, setEyeTypes] = useState<EyeTypeOption[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [eyeTypesError, setEyeTypesError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<IClient | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  
  // Estados de Modales
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<IClient | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [clientForHistory, setClientForHistory] = useState<IClient | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getEyeTypeLabel = (eyeType: unknown): string => {
    if (!eyeType) return "-";
    if (typeof eyeType === "string") return eyeType;
    if (typeof eyeType === "object" && eyeType !== null) {
      const candidate = eyeType as { name?: unknown; label?: unknown };
      if (typeof candidate.name === "string") return candidate.name;
      if (typeof candidate.label === "string") return candidate.label;
    }
    return String(eyeType);
  };

  useEffect(() => {
    const mainEl = document.querySelector<HTMLElement>(".main");
    mainEl?.scrollTo({ top: 0, behavior: "smooth" });

    const handleScroll = () => {
      setShowScrollTop((mainEl?.scrollTop ?? 0) > 260);
    };

    mainEl?.addEventListener("scroll", handleScroll, { passive: true });
    return () => mainEl?.removeEventListener("scroll", handleScroll);
  }, []);

  const loadClients = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingClients(true);
    setClientError(null);
    try {
      const clients = await ClientService.list({ branch_id: activeBranchId ?? undefined, limit: 1000 });
      setItems(clients);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      if (!silent) setClientError("No se pudieron cargar los clientes desde la API.");
    } finally {
      if (!silent) setIsLoadingClients(false);
    }
  }, [activeBranchId]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadClients(true);
    setIsRefreshing(false);
  };

  const handleToggleMarketplace = async (client: IClient) => {
    try {
      const updated = await ClientService.update(client.id, { marketplace_enabled: !client.marketplaceEnabled });
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(
        updated.marketplaceEnabled
          ? `Marketplace habilitado para ${client.nombre}`
          : `Marketplace deshabilitado para ${client.nombre}`
      );
    } catch {
      toast.error("No se pudo actualizar el acceso al marketplace.");
    }
  };

  const handleClearClientStatus = async (client: IClient) => {
    try {
      const updated = await ClientService.update(client.id, { status: "sin_estado" });
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      toast.error("No se pudo limpiar el estado del cliente.");
    }
  };

  useEffect(() => {
    void loadClients();

    pollingRef.current = setInterval(() => {
      void loadClients(true);
    }, 30_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadClients]);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) {
        handleChange();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => {
        setBranches(data);
        // Validar que el branch en localStorage aún exista; si no, limpiar y recargar
        const currentBranchId = getSelectedBranchId();
        if (currentBranchId && !data.some((b) => b.id === currentBranchId)) {
          setSelectedBranchId(null);
          setActiveBranchId(null);
        }
      })
      .catch((error) => {
        console.error("Error cargando sucursales:", error);
        setBranches([]);
      });
  }, []);

  const loadEyeTypes = async () => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    try {
      const data = await ClientService.listEyeTypes({ limit: 100 });
      if (data.length > 0) {
        setEyeTypes(data);
      } else {
        setEyeTypes(SEEDED_EYE_TYPES_FALLBACK);
      }
    } catch (error) {
      console.error("Error cargando tipos de ojos:", error);
      setEyeTypes(SEEDED_EYE_TYPES_FALLBACK);
      setEyeTypesError("No se pudieron cargar desde API. Se usan opciones base.");
    } finally {
      setIsLoadingEyeTypes(false);
    }
  };

  useEffect(() => {
    void loadEyeTypes();
  }, []);

  const handleScrollToTop = () => {
    const mainEl = document.querySelector<HTMLElement>(".main");
    mainEl?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Lógica de Filtrado
  const filteredItems = useMemo(() => {
    let result = items;

    // Filtro por Tab (Frecuentes)
    if (viewMode === "frequent") {
      result = result.filter(client => client.visitas > 5);
    }

    return result;
  }, [items, viewMode]);

  // Manejadores de Acción
  const handleCreate = () => {
    setClientToEdit(null);
    setIsRegisterOpen(true);
  };

  const handleEdit = (client: IClient) => {
    setClientToEdit(client);
    setIsRegisterOpen(true);
  };

  const handleViewHistory = (client: IClient) => {
    setClientForHistory(client);
    setIsHistoryOpen(true);
  };

  const handleDelete = (client: IClient) => {
    setClientToDelete(client);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;

    setIsDeletingClient(true);
    try {
      await ClientService.remove(clientToDelete.id);
      setItems((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setIsDeleteConfirmOpen(false);
      setClientToDelete(null);
      toast.success("Cliente eliminado correctamente.");
    } catch (error) {
      const message = getErrorMessage(error, "No se pudo eliminar el cliente.");
      toast.error(message);
      setIsDeleteConfirmOpen(false);
      setClientToDelete(null);
    } finally {
      setIsDeletingClient(false);
    }
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const candidate = error as { response?: { data?: { detail?: string; message?: string } } };
      return candidate.response?.data?.detail ?? candidate.response?.data?.message ?? fallback;
    }
    return fallback;
  };

  const handleRegisterClient = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const edadRaw = String(formData.get("edad") ?? "").trim();
    const phoneCountryCode = String(formData.get("phone_country_code") ?? "+591").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const sexo = String(formData.get("sexo") ?? "").trim();
    const eyeTypeRaw = String(formData.get("eye_type_id") ?? "").trim();
    const branchRaw = String(formData.get("branch_id") ?? "").trim();
    const ciRaw = String(formData.get("ci") ?? "").trim();

    if (!nombre || !apellido) {
      toast.warning("Nombre y apellido son obligatorios.");
      return;
    }

    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;

    if (edad !== undefined && (edad < 1 || edad > 100)) {
      const message = edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.";
      toast.warning(message);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const formattedPhone = normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : undefined;

    const parsedEyeTypeId = Number(eyeTypeRaw);
    const eye_type_id = eyeTypeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;

    const parsedBranchId = Number(branchRaw);
    const branch_id = branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;

    if (!clientToEdit && !branch_id) {
      toast.warning("Selecciona la sucursal donde registraras al cliente.");
      return;
    }

    try {
      if (clientToEdit) {
        const updated = await ClientService.update(clientToEdit.id, {
          name: nombre,
          last_name: apellido,
          age: edad,
          phone: formattedPhone,
          email: emailRaw || undefined,
          eye_type_id,
          branch_id,
          ci: ciRaw || undefined,
        });

        const updatedWithUiFields: IClient = {
          ...updated,
          sexo: (sexo as IClient["sexo"]) || clientToEdit.sexo || "Otro",
        };

        setItems((prev) => prev.map((client) => (client.id === updatedWithUiFields.id ? updatedWithUiFields : client)));
        setIsRegisterOpen(false);
        setClientToEdit(null);
        form.reset();
        toast.success("Cliente actualizado correctamente.");
        return;
      }

      const created = await ClientService.create({
        name: nombre,
        last_name: apellido,
        age: edad,
        phone: formattedPhone,
        email: emailRaw || undefined,
        eye_type_id,
        branch_id,
        ci: ciRaw || undefined,
      });

      const createdWithUiFields: IClient = {
        ...created,
        sexo: (sexo as IClient["sexo"]) || "Otro",
      };

      setItems((prev) => [createdWithUiFields, ...prev]);
      setIsRegisterOpen(false);
      form.reset();
      toast.success("Cliente registrado correctamente.");
    } catch (error) {
      const message = getErrorMessage(
        error,
        clientToEdit ? "No se pudo actualizar el cliente." : "No se pudo registrar el cliente."
      );
      toast.error(message);
    }
  };

  const frequentCount = useMemo(() => items.filter((c) => c.visitas > 5).length, [items]);

  // --- Columnas de la Tabla ---
  const columns: DataTableColumn<IClient>[] = [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      render: (item: IClient) => <span className="font-bold text-slate-800">{item.nombre}</span>
    },
    {
      key: "apellido",
      header: "Apellido",
      sortable: true,
      render: (item: IClient) => <span className="font-semibold text-slate-700">{item.apellido}</span>
    },
    {
      key: "visitas",
      header: "Frecuencia",
      sortable: true,
      render: (item: IClient) => (
        <div className="flex items-center gap-1.5">
           {item.visitas > 5 && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500"/>}
           <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
               item.visitas > 5 
               ? 'bg-amber-50 text-amber-700 border-amber-100' 
               : 'bg-slate-100 text-slate-600 border-slate-200'
           }`}>
               {item.visitas} visitas
           </span>
        </div>
      ) 
    },
    {
      key: "edad",
      header: "Edad",
      sortable: true,
      render: (item: IClient) => <span className="text-slate-600 text-sm font-medium">{item.edad} años</span>
    },
    {
      key: "tipoOjos",
      header: "Tipo de Ojos",
      sortable: true,
      getValue: (item: IClient) => getEyeTypeLabel(item.tipoOjos),
      render: (item: IClient) => <span className="text-sm text-slate-500 italic">{getEyeTypeLabel(item.tipoOjos)}</span>
    },
    {
      key: "ci",
      header: "CI",
      sortable: true,
      render: (item: IClient) => (
        <span className="text-xs font-mono text-slate-600">{item.ci || <span className="text-slate-300">—</span>}</span>
      ),
      getValue: (item: IClient) => item.ci ?? "",
    },
    {
      key: "marketplaceEnabled",
      header: "Marketplace",
      sortable: true,
      render: (item: IClient) => (
        <button
          type="button"
          onClick={() => void handleToggleMarketplace(item)}
          title={item.marketplaceEnabled ? "Deshabilitar acceso marketplace" : "Habilitar acceso marketplace"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            item.marketplaceEnabled
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          <ShoppingBag className="h-3 w-3" />
          {item.marketplaceEnabled ? "Activo" : "Inactivo"}
        </button>
      ),
      getValue: (item: IClient) => (item.marketplaceEnabled ? "Activo" : "Inactivo"),
    },
    {
      key: "status",
      header: "Estado",
      render: (item: IClient) => {
        const statusConfig: Record<string, { color: string; label: string }> = {
          en_servicio: { color: "bg-blue-100 text-blue-700", label: "En servicio" },
          en_espera: { color: "bg-amber-100 text-amber-700", label: "En espera" },
          pagado: { color: "bg-emerald-100 text-emerald-700", label: "Pagado" },
          reserva: { color: "bg-violet-100 text-violet-700", label: "Reserva" },
          finalizado: { color: "bg-green-100 text-green-700", label: "Finalizado" },
          sin_estado: { color: "bg-slate-200 text-slate-600", label: "Sin estado" },
          siendo_atendido: { color: "bg-blue-100 text-blue-700", label: "Siendo atendido" },
          atendido: { color: "bg-green-100 text-green-700", label: "Atendido" },
          cancelado: { color: "bg-red-100 text-red-700", label: "Cancelado" },
          no_se_presento: { color: "bg-orange-100 text-orange-700", label: "No se presentó" },
          reagendado: { color: "bg-yellow-100 text-yellow-700", label: "Reagendado" },
        };
        const currentStatus = item.status || "sin_estado";
        const { color, label } = statusConfig[currentStatus] ?? {
          color: "bg-slate-200 text-slate-600",
          label: currentStatus,
        };
        const isStale = currentStatus !== "sin_estado";
        return (
          <div className="flex items-center gap-1">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${color}`}>{label}</span>
            {isStale && (
              <button
                type="button"
                onClick={() => void handleClearClientStatus(item)}
                title="Limpiar estado"
                className="rounded-full p-0.5 text-slate-300 hover:bg-slate-100 hover:text-rose-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      },
      filterable: true,
      sortable: true,
      getValue: (item: IClient) => item.status || "sin_estado",
    },
  ];

  // --- Acciones de la Tabla ---
  const actions: DataTableAction<IClient>[] = [
    {
      label: "Historial",
      icon: <History className="w-4 h-4" />,
      onClick: (item: IClient) => handleViewHistory(item),
    },
    {
      label: "Editar",
      icon: <Edit className="w-4 h-4" />,
      onClick: (item: IClient) => handleEdit(item),
    },
    {
      label: "Eliminar",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (item: IClient) => handleDelete(item),
      variant: "danger",
    },
  ];

  const handleExportClientsPdf = () => {
    void generateTablePdf({
      title: "Listado de Clientes",
      subtitle: "Clientes registrados en el sistema",
      filename: "clientes",
      orientation: "landscape",
      meta: [
        { label: "Total clientes", value: String(filteredItems.length) },
        { label: "Vista", value: viewMode === "frequent" ? "Clientes Frecuentes" : "Lista General" },
      ],
      columns: [
        { key: "nombre", header: "Nombre" },
        { key: "apellido", header: "Apellido" },
        { key: "edad", header: "Edad" },
        { key: "tipoOjos", header: "Tipo de Ojos" },
        { key: "visitas", header: "Visitas" },
        { key: "status", header: "Estado" },
        { key: "phone", header: "Teléfono" },
      ],
      rows: filteredItems.map((c) => ({
        nombre: c.nombre ?? "—",
        apellido: c.apellido ?? "—",
        edad: c.edad != null ? `${c.edad} años` : "—",
        tipoOjos: getEyeTypeLabel(c.tipoOjos),
        visitas: c.visitas ?? 0,
        status: c.status ?? "—",
        phone: c.phone ?? "—",
      })),
    });
  };

  // --- Renderizado del Toolbar ---
  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          <Button
            variant="ghost"
            size="md"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => setViewMode("all")}
            className={
              viewMode === "all"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }
          >
            Lista General
          </Button>

          <Button
            variant="ghost"
            size="md"
            leftIcon={<Star className={`h-4 w-4 ${viewMode === "frequent" ? "fill-[#094732]" : ""}`} />}
            onClick={() => setViewMode("frequent")}
            className={
              viewMode === "frequent"
                ? "bg-white text-[#094732] shadow-sm ring-1 ring-black/5"
                : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }
          >
            Clientes Frecuentes
          </Button>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void handleManualRefresh()}
            leftIcon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />}
            title="Actualizar estados"
            disabled={isRefreshing}
            className="whitespace-nowrap"
          >
            Actualizar
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportClientsPdf}
            leftIcon={<FileDown className="h-4 w-4" />}
            title="Descargar reporte PDF"
            className="whitespace-nowrap"
          >
            PDF
          </Button>
          <Button onClick={handleCreate} leftIcon={<Plus className="h-5 w-5" />} className="whitespace-nowrap">
            Agregar Cliente
          </Button>
        </div>
      }
    />
  );

  return (
    <>
      <Layout
        title="Gestión de Clientes"
        subtitle="Administra tu base de datos de clientes"
        variant="table"
        topContent={(
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Total clientes"
              value={items.length}
              icon={<Users className="h-4 w-4" />}
              tone="emerald"
            />
            <StatCard
              label="Clientes frecuentes"
              value={frequentCount}
              icon={<Star className="h-4 w-4" />}
              tone="slate"
            />
          </div>
        )}
        toolbar={renderToolbar()}
      >
        {clientError ? (
          <SectionCard className="mb-4 border border-rose-200 bg-rose-50" bodyClassName="!p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-rose-700">{clientError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadClients()}>
                Reintentar
              </Button>
            </div>
          </SectionCard>
        ) : null}

        <DataTable
          data={filteredItems}
          columns={columns}
          actions={actions}
          defaultLimit={10}
          availableLimits={[5, 10, 20, 50]}
          globalSearchPlaceholder={isLoadingClients ? "Cargando clientes..." : "Buscar clientes por nombre, apellido o estado..."}
          enableColumnFilters
        />
      </Layout>

      {/* --- Modales Simulados --- */}

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Eliminar cliente"
        message={
          <p>
            ¿Seguro que deseas eliminar a <strong>{clientToDelete?.nombre} {clientToDelete?.apellido}</strong>? Esta acción no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isProcessing={isDeletingClient}
        onConfirm={() => void confirmDeleteClient()}
        onCancel={() => {
          if (isDeletingClient) return;
          setIsDeleteConfirmOpen(false);
          setClientToDelete(null);
        }}
      />

      <RegisterClientModal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setClientToEdit(null);
        }}
        onSubmit={handleRegisterClient}
        eyeTypes={eyeTypes}
        branches={branches}
        eyeTypesError={eyeTypesError}
        isLoadingEyeTypes={isLoadingEyeTypes}
        onRetryEyeTypes={() => void loadEyeTypes()}
        mode={clientToEdit ? "edit" : "create"}
        initialClient={clientToEdit}
      />

      <ClientSalesHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setClientForHistory(null);
        }}
        client={clientForHistory}
      />

      <Button
        onClick={handleScrollToTop}
        aria-label="Volver arriba"
        className={`fixed bottom-6 right-6 z-40 rounded-full! p-3! shadow-lg shadow-emerald-900/30 ${
          showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </Button>

    </>
  );
}