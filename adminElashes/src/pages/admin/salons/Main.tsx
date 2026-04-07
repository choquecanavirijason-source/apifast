import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Search, Pencil, Trash2, Store, Plus } from "lucide-react";
import { toast } from "react-toastify";
import Layout from "../../../components/common/layout.tsx";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { BranchService } from "../../../core/services/branch/branch.service.ts";
import {
  COUNTRY_CITY_OPTIONS,
  COUNTRY_OPTIONS,
  emptyForm,
  mapBranchToSalon,
  type Salon,
  type SalonForm,
} from "./utils";
import SalonsFormModal from "./SalonsFormModal";

type SalonFormErrors = Partial<Record<keyof SalonForm, string>>;

export default function SalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [salonToDelete, setSalonToDelete] = useState<Salon | null>(null);
  const [form, setForm] = useState<SalonForm>(emptyForm);

  const formErrors = useMemo<SalonFormErrors>(() => {
    const errors: SalonFormErrors = {};
    const name = form.name.trim();
    const address = form.address.trim();

    if (!name) {
      errors.name = "El nombre del salon es obligatorio.";
    } else if (name.length < 2) {
      errors.name = "El nombre debe tener al menos 2 caracteres.";
    }

    if (!form.department.trim()) {
      errors.department = "Selecciona un pais.";
    }

    if (!form.city.trim()) {
      errors.city = "Selecciona una ciudad.";
    }

    if (form.department && form.city) {
      const validCities = COUNTRY_CITY_OPTIONS[form.department] ?? [];
      if (!validCities.includes(form.city)) {
        errors.city = "La ciudad seleccionada no corresponde al pais.";
      }
    }

    if (address.length > 255) {
      errors.address = "La direccion no puede superar los 255 caracteres.";
    }

    return errors;
  }, [form]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const candidate = error as { response?: { data?: { detail?: string; message?: string } } };
      return candidate.response?.data?.detail ?? candidate.response?.data?.message ?? fallback;
    }
    return fallback;
  };

  const loadBranches = async (filters?: { city?: string; department?: string }) => {
    setIsLoading(true);
    try {
      const data = await BranchService.list({
        limit: 300,
        city: filters?.city,
        department: filters?.department,
      });
      setSalons(data.map(mapBranchToSalon));
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron cargar las sucursales."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const trimmedCity = cityFilter.trim();
    const trimmedDepartment = departmentFilter.trim();

    void loadBranches({
      city: trimmedCity || undefined,
      department: trimmedDepartment || undefined,
    });
  }, [cityFilter, departmentFilter]);

  const filteredSalons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return salons;

    return salons.filter((salon) => {
      return (
        salon.name.toLowerCase().includes(query) ||
        salon.address.toLowerCase().includes(query) ||
        salon.city.toLowerCase().includes(query) ||
        salon.department.toLowerCase().includes(query)
      );
    });
  }, [salons, search]);

  const availableCities = useMemo(() => {
    const cities = COUNTRY_CITY_OPTIONS[form.department] ?? [];
    if (form.city && !cities.includes(form.city)) {
      return [form.city, ...cities];
    }
    return cities;
  }, [form.department, form.city]);

  const availableFilterCities = useMemo(() => {
    if (departmentFilter) {
      return COUNTRY_CITY_OPTIONS[departmentFilter] ?? [];
    }

    const allCities = Object.values(COUNTRY_CITY_OPTIONS).flat();
    return Array.from(new Set(allCities)).sort((a, b) => a.localeCompare(b));
  }, [departmentFilter]);

  const requestRemoveSalon = (salon: Salon) => {
    setSalonToDelete(salon);
    setIsDeleteConfirmOpen(true);
  };

  const confirmRemoveSalon = async () => {
    if (!salonToDelete) return;

    setIsMutating(true);
    try {
      await BranchService.remove(salonToDelete.id);
      setIsDeleteConfirmOpen(false);
      setSalonToDelete(null);
      toast.success("Sucursal eliminada correctamente.");
      await loadBranches();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar la sucursal."));
    } finally {
      setIsMutating(false);
    }
  };

  const openCreate = () => {
    setIsEditing(false);
    setSelectedId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (salon: Salon) => {
    setIsEditing(true);
    setSelectedId(salon.id);
    setForm({
      name: salon.name,
      address: salon.address,
      city: salon.city,
      department: salon.department,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleTextChange = (field: keyof SalonForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (value: string) => {
    setForm((prev) => {
      const nextCities = COUNTRY_CITY_OPTIONS[value] ?? [];
      return {
        ...prev,
        department: value,
        city: nextCities.includes(prev.city) ? prev.city : "",
      };
    });
  };

  const handleDepartmentFilterChange = (value: string) => {
    setDepartmentFilter(value);

    const allowedCities = value ? COUNTRY_CITY_OPTIONS[value] ?? [] : [];
    if (value && cityFilter && !allowedCities.includes(cityFilter)) {
      setCityFilter("");
    }
  };

  const saveSalon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (Object.keys(formErrors).length > 0) {
      const firstError = Object.values(formErrors)[0];
      if (firstError) {
        toast.warning(firstError);
      }
      return;
    }

    const normalized: SalonForm = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      department: form.department.trim(),
    };

    setIsMutating(true);
    try {
      if (isEditing && selectedId !== null) {
        await BranchService.update(selectedId, {
          name: normalized.name,
          address: normalized.address || undefined,
          city: normalized.city || undefined,
          department: normalized.department || undefined,
        });
        toast.success("Sucursal actualizada correctamente.");
      } else {
        await BranchService.create({
          name: normalized.name,
          address: normalized.address || undefined,
          city: normalized.city || undefined,
          department: normalized.department || undefined,
        });
        toast.success("Sucursal creada correctamente.");
      }

      closeModal();
      await loadBranches();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar la sucursal."));
    } finally {
      setIsMutating(false);
    }
  };

  const renderToolbar = () => (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
        Total salones: {salons.length}
      </div>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
      >
        <Plus className="h-4 w-4" /> Nuevo salon
      </button>
    </div>
  );

  return (
    <>
      <Layout
        title="Salones"
        subtitle="Control de sucursales creadas y su estado operativo."
        variant="cards"
        toolbar={renderToolbar()}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="relative w-full md:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por salon, direccion, ciudad o departamento"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-slate-900"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={departmentFilter}
              onChange={(event) => handleDepartmentFilterChange(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="">Todos los paises</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>

            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900"
            >
              <option value="">Todas las ciudades</option>
              {availableFilterCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                Cargando sucursales...
              </div>
            ) : null}

            {!isLoading && filteredSalons.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                No se encontraron salones.
              </div>
            ) : null}

            {!isLoading && filteredSalons.map((salon) => (
              <div key={salon.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                      <Store className="h-4 w-4" /> {salon.name}
                    </h3>
                    <p className="text-sm text-slate-500">Sucursal registrada</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Activo
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>Direccion: {salon.address || "-"}</p>
                  <p>Ciudad: {salon.city || "-"}</p>
                  <p>Pais: {salon.department || "-"}</p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(salon)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => requestRemoveSalon(salon)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>

      <SalonsFormModal
        isOpen={isModalOpen}
        isEditing={isEditing}
        isSubmitting={isMutating}
        form={form}
        errors={formErrors}
        countryOptions={COUNTRY_OPTIONS}
        availableCities={availableCities}
        onTextChange={handleTextChange}
        onCountryChange={handleCountryChange}
        onSubmit={(event) => void saveSalon(event)}
        onClose={closeModal}
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Eliminar sucursal"
        message={
          <p>
            ¿Seguro que deseas eliminar <strong>{salonToDelete?.name}</strong>? Esta accion no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isProcessing={isMutating}
        onConfirm={() => void confirmRemoveSalon()}
        onCancel={() => {
          if (isMutating) return;
          setIsDeleteConfirmOpen(false);
          setSalonToDelete(null);
        }}
      />
    </>
  );
}
