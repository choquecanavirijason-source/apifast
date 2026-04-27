import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import Layout from "../../../components/common/layout";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, SectionCard } from "../../../components/common/ui";
import {
  AgendaService,
  deriveServiceCategoriesFromServices,
  type ServiceCategoryOption,
  type ServiceOption,
} from "../../../core/services/agenda/agenda.service";
import { getApiErrorMessage } from "../../../core/utils/apiError";

import DeleteServiceModal from "./components/DeleteServiceModal";
import ServiceCard from "./components/ServiceCard";
import ServiceFormModal from "./components/ServiceFormModal";
import ServicesTopStats from "./components/ServicesTopStats";
import ServicesToolbar from "./components/ServicesToolbar";
import { emptyServiceForm, emptyServiceItemForm, type ServiceFormState, type ServiceItemFormState } from "./services.types";

export default function ServicesPage() {
  const location = useLocation();
  const isCategoriesView = location.pathname === "/admin/services/categories";

  const [categories, setCategories] = useState<ServiceCategoryOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteOneModalOpen, setIsDeleteOneModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [openServiceMenuId, setOpenServiceMenuId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryOption | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyServiceForm);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceItemFormState>(emptyServiceItemForm);
  const [isCreateServiceModalOpen, setIsCreateServiceModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [isDeleteServiceModalOpen, setIsDeleteServiceModalOpen] = useState(false);
  const [isUploadingServiceImage, setIsUploadingServiceImage] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  const categoriesPerPage = 9;
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePage, setServicePage] = useState(1);
  const servicesPerPage = 9;

  const loadCatalog = async () => {
    setIsLoadingCategories(true);
    setIsLoadingServices(true);
    try {
      let serviceList: ServiceOption[] = [];
      try {
        serviceList = await AgendaService.listServices({ limit: 300 });
        setServices(serviceList);
      } catch (reason) {
        console.error("Error cargando servicios:", reason);
        setServices([]);
        toast.error(getApiErrorMessage(reason, "No se pudieron cargar los servicios."));
      }

      const derivedFromServices = deriveServiceCategoriesFromServices(serviceList);

      try {
        const apiCategories = await AgendaService.listServiceCategories();
        setCategories(apiCategories.length > 0 ? apiCategories : derivedFromServices);
        if (apiCategories.length === 0 && derivedFromServices.length > 0) {
          toast.info(
            "No hay categorías en el endpoint; se muestran las inferidas desde los servicios hasta que el backend exponga GET /services/categories."
          );
        }
      } catch (reason) {
        const is404 = axios.isAxiosError(reason) && reason.response?.status === 404;
        setCategories(derivedFromServices);
        if (is404) {
          if (derivedFromServices.length > 0) {
            toast.warning(
              "El backend respondió 404 en /services/categories. Usando categorías deducidas de los servicios. Reinicia la API con service_categories_controller actualizado."
            );
          } else if (serviceList.length === 0) {
            toast.error(
              "No se pudieron cargar categorías (404) ni servicios para deducirlas. Revisa la API y VITE_API_URL."
            );
          } else {
            toast.warning(
              "Categorías no disponibles (404) y los servicios no incluyen datos de categoría. Crea categorías en BD o despliega el backend actualizado."
            );
          }
        } else {
          console.error("Error cargando categorías:", reason);
          toast.error(getApiErrorMessage(reason, "No se pudieron cargar las categorías."));
        }
      }
    } finally {
      setIsLoadingCategories(false);
      setIsLoadingServices(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const totalWithImage = useMemo(
    () => categories.filter((category) => Boolean(category.image_url?.trim())).length,
    [categories]
  );

  const totalWithDescription = useMemo(
    () => categories.filter((category) => Boolean(category.description?.trim())).length,
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) => {
      const name = category.name?.toLowerCase() ?? "";
      const description = category.description?.toLowerCase() ?? "";
      return name.includes(term) || description.includes(term);
    });
  }, [categories, categorySearch]);

  const totalCategoryPages = Math.max(1, Math.ceil(filteredCategories.length / categoriesPerPage));

  const paginatedCategories = useMemo(() => {
    const safePage = Math.min(categoryPage, totalCategoryPages);
    const start = (safePage - 1) * categoriesPerPage;
    return filteredCategories.slice(start, start + categoriesPerPage);
  }, [filteredCategories, categoryPage, totalCategoryPages]);

  const categoryPageNumbers = useMemo(() => {
    const maxButtons = 5;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, categoryPage - half);
    let end = Math.min(totalCategoryPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [categoryPage, totalCategoryPages]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    if (!term) return services;
    return services.filter((service) => {
      const name = service.name?.toLowerCase() ?? "";
      const description = service.description?.toLowerCase() ?? "";
      const categoryName =
        service.category?.name?.toLowerCase() ??
        (service.category_id ? categoryById.get(service.category_id)?.name?.toLowerCase() : "") ??
        "";
      return name.includes(term) || description.includes(term) || categoryName.includes(term);
    });
  }, [services, serviceSearch, categoryById]);

  const totalServicePages = Math.max(1, Math.ceil(filteredServices.length / servicesPerPage));

  const paginatedServices = useMemo(() => {
    const safePage = Math.min(servicePage, totalServicePages);
    const start = (safePage - 1) * servicesPerPage;
    return filteredServices.slice(start, start + servicesPerPage);
  }, [filteredServices, servicePage, totalServicePages]);

  const servicePageNumbers = useMemo(() => {
    const maxButtons = 5;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, servicePage - half);
    let end = Math.min(totalServicePages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [servicePage, totalServicePages]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch]);

  useEffect(() => {
    if (categoryPage > totalCategoryPages) {
      setCategoryPage(totalCategoryPages);
    }
  }, [categoryPage, totalCategoryPages]);

  useEffect(() => {
    setServicePage(1);
  }, [serviceSearch]);

  useEffect(() => {
    if (servicePage > totalServicePages) {
      setServicePage(totalServicePages);
    }
  }, [servicePage, totalServicePages]);

  const handleFormChange = <K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getFormValidationError = () => {
    const trimmedName = form.name.trim();

    if (!trimmedName) return "Debes ingresar el nombre de la categoria.";
    return null;
  };

  const handleOpenCreate = () => {
    setForm(emptyServiceForm);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (category: ServiceCategoryOption) => {
    setSelectedCategory(category);
    setForm({
      name: category.name ?? "",
      description: category.description ?? "",
      imageUrl: category.image_url ?? "",
      isMobile: Boolean(category.is_mobile),
    });
    setOpenMenuId(null);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteOneModalOpen(false);
    setSelectedCategory(null);
    setForm(emptyServiceForm);
    setIsUploadingImage(false);
  };

  const handleCloseServiceModal = () => {
    setIsCreateServiceModalOpen(false);
    setIsEditServiceModalOpen(false);
    setIsDeleteServiceModalOpen(false);
    setOpenServiceMenuId(null);
    setSelectedService(null);
    setServiceForm(emptyServiceItemForm);
    setIsUploadingServiceImage(false);
  };

  const handleImageSelected = async (file?: File | null) => {
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const imageUrl = await AgendaService.uploadServiceCategoryImage(file);
      setForm((prev) => ({ ...prev, imageUrl }));
      toast.success("Imagen cargada correctamente.");
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      toast.error(getApiErrorMessage(error, "No se pudo subir la imagen."));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleAddCategory = async () => {
    const validationError = getFormValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const created = await AgendaService.createServiceCategory({
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.imageUrl.trim() || null,
        is_mobile: form.isMobile,
      });
      setCategories((prev) => [created, ...prev]);
      toast.success("Categoria creada correctamente.");
      handleCloseModal();
      void loadCatalog();
    } catch (error) {
      console.error("Error creando categoria:", error);
      toast.error(getApiErrorMessage(error, "No se pudo crear la categoria."));
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory) return;
    const validationError = getFormValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const updated = await AgendaService.updateServiceCategory(selectedCategory.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.imageUrl.trim(),
        is_mobile: form.isMobile,
      });
      setCategories((prev) => prev.map((category) => (category.id === updated.id ? updated : category)));
      toast.success("Categoria actualizada correctamente.");
      handleCloseModal();
      void loadCatalog();
    } catch (error) {
      console.error("Error actualizando categoria:", error);
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la categoria."));
    }
  };

  const handleOpenDeleteModal = (category: ServiceCategoryOption) => {
    setSelectedCategory(category);
    setOpenMenuId(null);
    setIsDeleteOneModalOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    try {
      await AgendaService.deleteServiceCategory(selectedCategory.id);
      setCategories((prev) => prev.filter((category) => category.id !== selectedCategory.id));
      toast.success("Categoria eliminada correctamente.");
      handleCloseModal();
    } catch (error) {
      console.error("Error eliminando categoria:", error);
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la categoria."));
    }
  };

  const handleServiceFormChange = (field: keyof ServiceItemFormState, value: string) => {
    setServiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const getServiceFormValidationError = () => {
    if (!serviceForm.name.trim()) return "Debes ingresar el nombre del servicio.";
    if (!serviceForm.categoryId.trim()) return "Debes seleccionar una categoria.";

    const duration = Number(serviceForm.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return "La duracion debe ser mayor a 0.";

    const price = Number(serviceForm.price);
    if (!Number.isFinite(price) || price < 0) return "El precio no puede ser negativo.";

    return null;
  };

  const handleOpenCreateService = () => {
    setServiceForm(emptyServiceItemForm);
    setIsCreateServiceModalOpen(true);
  };

  const handleOpenEditService = (service: ServiceOption) => {
    setSelectedService(service);
    setServiceForm({
      name: service.name ?? "",
      description: service.description ?? "",
      imageUrl: service.image_url ?? "",
      categoryId: service.category_id ? String(service.category_id) : "",
      durationMinutes: String(service.duration_minutes ?? ""),
      price: String(service.price ?? ""),
    });
    setOpenServiceMenuId(null);
    setIsEditServiceModalOpen(true);
  };

  const handleOpenDeleteServiceModal = (service: ServiceOption) => {
    setSelectedService(service);
    setOpenServiceMenuId(null);
    setIsDeleteServiceModalOpen(true);
  };

  const handleServiceImageSelected = async (file?: File | null) => {
    if (!file) return;
    setIsUploadingServiceImage(true);
    try {
      const imageUrl = await AgendaService.uploadServiceImage(file);
      setServiceForm((prev) => ({ ...prev, imageUrl }));
      toast.success("Imagen del servicio cargada correctamente.");
    } catch (error) {
      console.error("Error subiendo imagen del servicio:", error);
      toast.error(getApiErrorMessage(error, "No se pudo subir la imagen del servicio."));
    } finally {
      setIsUploadingServiceImage(false);
    }
  };

  const handleAddService = async () => {
    const validationError = getServiceFormValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const created = await AgendaService.createService({
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        image_url: serviceForm.imageUrl.trim() || null,
        category_id: Number(serviceForm.categoryId),
        duration_minutes: Number(serviceForm.durationMinutes),
        price: Number(serviceForm.price),
      });
      setServices((prev) => [created, ...prev]);
      toast.success("Servicio creado correctamente.");
      handleCloseServiceModal();
    } catch (error) {
      console.error("Error creando servicio:", error);
      toast.error(getApiErrorMessage(error, "No se pudo crear el servicio."));
    }
  };

  const handleEditService = async () => {
    if (!selectedService) return;

    const validationError = getServiceFormValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const updated = await AgendaService.updateService(selectedService.id, {
        name: serviceForm.name.trim(),
        description: serviceForm.description.trim() || null,
        image_url: serviceForm.imageUrl.trim() || null,
        category_id: Number(serviceForm.categoryId),
        duration_minutes: Number(serviceForm.durationMinutes),
        price: Number(serviceForm.price),
      });
      setServices((prev) => prev.map((service) => (service.id === updated.id ? updated : service)));
      toast.success("Servicio actualizado correctamente.");
      handleCloseServiceModal();
    } catch (error) {
      console.error("Error actualizando servicio:", error);
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el servicio."));
    }
  };

  const handleDeleteService = async () => {
    if (!selectedService) return;

    try {
      await AgendaService.deleteService(selectedService.id);
      setServices((prev) => prev.filter((service) => service.id !== selectedService.id));
      toast.success("Servicio eliminado correctamente.");
      handleCloseServiceModal();
    } catch (error) {
      console.error("Error eliminando servicio:", error);
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el servicio."));
    }
  };

  const totalCategories = categories.length;
  const totalServices = services.length;
  const isLoading = isLoadingCategories || isLoadingServices;

  return (
    <Layout
      title={isCategoriesView ? "Categorías de servicio" : "Catálogo de servicios"}
      subtitle={
        isCategoriesView
          ? "Gestiona las categorías; cada servicio del catálogo pertenece a una."
          : "Gestiona servicios y asigna a cada uno su categoría de servicio."
      }
      variant="cards"
      topContent={
        <ServicesTopStats
          totalCategories={totalCategories}
          totalServices={totalServices}
          totalWithImage={totalWithImage}
          totalWithDescription={totalWithDescription}
        />
      }
    >
      {isCategoriesView ? (
        <ServicesToolbar onCreateCategory={handleOpenCreate} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Catálogo de servicios</h2>
            <p className="text-xs text-slate-500">Cada servicio tiene una categoría de servicio asignada.</p>
          </div>
          <Button onClick={handleOpenCreateService}>
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Button>
        </div>
      )}

      {isLoading ? (
        <SectionCard className="mt-4" bodyClassName="!p-6">
          <p className="text-sm text-slate-500">
            {isCategoriesView ? "Cargando categorías de servicio..." : "Cargando catálogo de servicios..."}
          </p>
        </SectionCard>
      ) : null}

      {isCategoriesView ? (
        <>
          <SectionCard className="mt-4 border-[#d2d0ce] bg-[#faf9f8]" bodyClassName="!p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#323130]">Categorías de servicio</h3>
                  <p className="text-xs text-[#605e5c]">Vista estilo Dynamics 365 con búsqueda y paginación</p>
                </div>
                <div className="text-xs text-[#605e5c]">
                  Mostrando <span className="font-semibold text-[#323130]">{paginatedCategories.length}</span> de{" "}
                  <span className="font-semibold text-[#323130]">{filteredCategories.length}</span>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Buscar categoría por nombre o descripción..."
                  className="h-10 w-full rounded-sm border border-[#8a8886] bg-white pl-9 pr-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                />
              </div>
            </div>
          </SectionCard>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedCategories.map((category) => {
              return (
                <ServiceCard
                  key={category.id}
                  service={category}
                  isMenuOpen={openMenuId === category.id}
                  onToggleMenu={() => setOpenMenuId(openMenuId === category.id ? null : category.id)}
                  onEdit={() => handleOpenEditModal(category)}
                  onDelete={() => handleOpenDeleteModal(category)}
                />
              );
            })}
          </div>

          {filteredCategories.length === 0 ? (
            <SectionCard className="mt-4 border-[#d2d0ce] bg-white" bodyClassName="!p-6">
              <p className="text-sm text-[#605e5c]">No se encontraron categorías con ese criterio de búsqueda.</p>
            </SectionCard>
          ) : null}

          {filteredCategories.length > categoriesPerPage ? (
            <SectionCard className="mt-4 border-[#d2d0ce] bg-white" bodyClassName="!p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#605e5c]">
                  Página <span className="font-semibold text-[#323130]">{categoryPage}</span> de{" "}
                  <span className="font-semibold text-[#323130]">{totalCategoryPages}</span>
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCategoryPage((prev) => Math.max(1, prev - 1))}
                    disabled={categoryPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {categoryPageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCategoryPage(pageNumber)}
                      className={`h-8 min-w-8 rounded-sm border px-2 text-xs font-semibold transition ${
                        pageNumber === categoryPage
                          ? "border-[#0078d4] bg-[#0078d4] text-white"
                          : "border-[#d2d0ce] bg-white text-[#323130] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCategoryPage((prev) => Math.min(totalCategoryPages, prev + 1))}
                    disabled={categoryPage >= totalCategoryPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : (
        <>
          <SectionCard className="mt-4 border-[#d2d0ce] bg-[#faf9f8]" bodyClassName="!p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#323130]">Servicios</h3>
                  <p className="text-xs text-[#605e5c]">Vista estilo Dynamics 365 con búsqueda y paginación</p>
                </div>
                <div className="text-xs text-[#605e5c]">
                  Mostrando <span className="font-semibold text-[#323130]">{paginatedServices.length}</span> de{" "}
                  <span className="font-semibold text-[#323130]">{filteredServices.length}</span>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Buscar servicio por nombre, descripción o categoría..."
                  className="h-10 w-full rounded-sm border border-[#8a8886] bg-white pl-9 pr-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                />
              </div>
            </div>
          </SectionCard>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedServices.map((service) => {
              const categoryName =
                service.category?.name ??
                (service.category_id ? categoryById.get(service.category_id)?.name : undefined) ??
                "Sin categoria";

              return (
                <SectionCard key={service.id} className="relative" bodyClassName="!p-4">
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="mb-3 h-56 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                      loading="lazy"
                    />
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-800">{service.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{service.description || "Sin descripcion"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenServiceMenuId(openServiceMenuId === service.id ? null : service.id)}
                      className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                      aria-label="Abrir menu"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">Categoria: {categoryName}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{service.duration_minutes} min</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">Bs {Number(service.price ?? 0).toFixed(2)}</span>
                  </div>

                  {openServiceMenuId === service.id ? (
                    <div className="absolute right-4 top-12 z-10 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      <button
                        type="button"
                        onClick={() => handleOpenEditService(service)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteServiceModal(service)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </SectionCard>
              );
            })}
          </div>

          {filteredServices.length === 0 ? (
            <SectionCard className="mt-4 border-[#d2d0ce] bg-white" bodyClassName="!p-6">
              <p className="text-sm text-[#605e5c]">No se encontraron servicios con ese criterio de búsqueda.</p>
            </SectionCard>
          ) : null}

          {filteredServices.length > servicesPerPage ? (
            <SectionCard className="mt-4 border-[#d2d0ce] bg-white" bodyClassName="!p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#605e5c]">
                  Página <span className="font-semibold text-[#323130]">{servicePage}</span> de{" "}
                  <span className="font-semibold text-[#323130]">{totalServicePages}</span>
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setServicePage((prev) => Math.max(1, prev - 1))}
                    disabled={servicePage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {servicePageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setServicePage(pageNumber)}
                      className={`h-8 min-w-8 rounded-sm border px-2 text-xs font-semibold transition ${
                        pageNumber === servicePage
                          ? "border-[#0078d4] bg-[#0078d4] text-white"
                          : "border-[#d2d0ce] bg-white text-[#323130] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setServicePage((prev) => Math.min(totalServicePages, prev + 1))}
                    disabled={servicePage >= totalServicePages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </>
      )}

      <ServiceFormModal
        isOpen={isCreateModalOpen}
        title="Nueva categoria"
        submitLabel="Crear"
        onClose={handleCloseModal}
        onSubmit={() => void handleAddCategory()}
        form={form}
        onFormChange={handleFormChange}
        isUploadingImage={isUploadingImage}
        onImageSelected={handleImageSelected}
      />

      <ServiceFormModal
        isOpen={isEditModalOpen}
        title="Editar categoria"
        submitLabel="Guardar"
        onClose={handleCloseModal}
        onSubmit={() => void handleEditCategory()}
        form={form}
        onFormChange={handleFormChange}
        isUploadingImage={isUploadingImage}
        onImageSelected={handleImageSelected}
      />

      <DeleteServiceModal
        isOpen={isDeleteOneModalOpen}
        onClose={handleCloseModal}
        onConfirm={() => void handleDeleteCategory()}
        serviceName={selectedCategory?.name}
      />

      <GenericModal
        isOpen={isCreateServiceModalOpen || isEditServiceModalOpen}
        onClose={handleCloseServiceModal}
        title={isEditServiceModalOpen ? "Editar servicio" : "Nuevo servicio"}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre *</label>
            <input
              value={serviceForm.name}
              onChange={(event) => handleServiceFormChange("name", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Categoria *</label>
              <select
                value={serviceForm.categoryId}
                onChange={(event) => handleServiceFormChange("categoryId", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              >
                <option value="">Selecciona una categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Duracion (min) *</label>
              <input
                type="number"
                min={1}
                value={serviceForm.durationMinutes}
                onChange={(event) => handleServiceFormChange("durationMinutes", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Precio *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={serviceForm.price}
              onChange={(event) => handleServiceFormChange("price", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Descripcion</label>
            <textarea
              rows={3}
              value={serviceForm.description}
              onChange={(event) => handleServiceFormChange("description", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Imagen del servicio</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleServiceImageSelected(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
            />
            {isUploadingServiceImage ? <p className="text-xs text-slate-500">Subiendo imagen...</p> : null}
            {serviceForm.imageUrl ? (
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={serviceForm.imageUrl}
                  alt="Preview"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
                <Button type="button" variant="secondary" onClick={() => handleServiceFormChange("imageUrl", "")}
                >
                  Quitar imagen
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCloseServiceModal}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void (isEditServiceModalOpen ? handleEditService() : handleAddService())}
              disabled={isUploadingServiceImage}
            >
              {isEditServiceModalOpen ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>
      </GenericModal>

      <GenericModal
        isOpen={isDeleteServiceModalOpen}
        onClose={handleCloseServiceModal}
        title="Eliminar servicio"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
            <Trash2 className="h-5 w-5 text-rose-600" />
            <p className="text-sm text-slate-600">
              ¿Seguro que deseas eliminar el servicio <strong>{selectedService?.name}</strong>?
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleCloseServiceModal}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleDeleteService()}>
              Eliminar
            </Button>
          </div>
        </div>
      </GenericModal>
    </Layout>
  );
}
