// src/pages/admin/Volumen/hooks/useVolumen.ts
import { useState, useMemo, useEffect } from "react";
import type { LashVolume, VolumenFormState } from "../types";
import api from "@/core/services/api";
import { toast } from "react-toastify";

const emptyForm: VolumenFormState = {
  name: "",
  description: "",
  image: "",
  modelFileName: "",
  modelFileUrl: "",
  maintenanceDays: "",
  removalDays: "",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === "string"
  ) {
    return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? fallback;
  }
  return fallback;
};

export const useVolumen = () => {
  const [volumes, setVolumes] = useState<LashVolume[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [form, setForm] = useState<VolumenFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Configuración del diálogo de confirmación
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "primary" | "danger";
  } | null>(null);

  // Filtrado
  const filteredVolumes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return volumes;
    return volumes.filter(
      (v) => v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
    );
  }, [volumes, search]);

  const loadVolumes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/catalogs/volumes");
      setVolumes(response.data);
    } catch (error) {
      toast.error("Error al cargar volumenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVolumes();
  }, []);

  // --- Acciones del Modal ---
  const openCreate = () => {
    setCurrentId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (volume: LashVolume) => {
    setCurrentId(volume.id);
    setForm({
      name: volume.name,
      description: volume.description,
      image: volume.image,
      modelFileName: volume.model_3d_filename ?? "",
      modelFileUrl: volume.model_3d_url ?? "",
      maintenanceDays: volume.maintenance_days != null ? String(volume.maintenance_days) : "",
      removalDays: volume.removal_days != null ? String(volume.removal_days) : "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setCurrentId(null);
  };

  const handleInputChange = (field: keyof VolumenFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModelChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingModel(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/catalogs/designs/upload-model", formData);
      setForm((prev) => ({
        ...prev,
        modelFileName: response.data.model_3d_filename ?? file.name,
        modelFileUrl: response.data.model_3d_url,
      }));
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo subir el modelo 3D"));
    } finally {
      setUploadingModel(false);
      event.target.value = "";
    }
  };

  const removeModel = () => setForm((prev) => ({ ...prev, modelFileName: "", modelFileUrl: "" }));

  // --- CRUD (Simulado) ---
  const saveVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        image: form.image || null,
        model_3d_url: form.modelFileUrl || null,
        model_3d_filename: form.modelFileName || null,
        maintenance_days: form.maintenanceDays.trim() ? Number(form.maintenanceDays) : null,
        removal_days: form.removalDays.trim() ? Number(form.removalDays) : null,
      };
      if (currentId) {
        await api.put(`/catalogs/volumes/${currentId}`, payload);
      } else {
        await api.post("/catalogs/volumes", payload);
      }
      await loadVolumes();
      closeModal();
      toast.success(currentId ? "Volumen actualizado." : "Volumen creado.");
    } catch (error) {
      toast.error("No se pudo guardar el volumen");
    } finally {
      setSaving(false);
    }
  };

  // --- Dialog & Delete ---
  const closeDialog = () => setDialogConfig(null);

  const handleDelete = async (volume: LashVolume) => {
    setIsProcessing(true);
    try {
      await api.delete(`/catalogs/volumes/${volume.id}`);
      await loadVolumes();
      closeDialog();
      toast.success("Volumen eliminado.");
    } catch (error) {
      toast.error("No se pudo eliminar el volumen");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = (volume: LashVolume) => {
    setDialogConfig({
      isOpen: true,
      title: "Eliminar Volumen",
      message: `¿Estás seguro de que deseas eliminar "${volume.name}"? Esta acción no se puede deshacer.`,
      variant: "danger",
      onConfirm: () => handleDelete(volume),
    });
  };

  return {
    volumes: filteredVolumes,
    search,
    setSearch,
    loading,
    isModalOpen,
    form,
    saving,
    uploadingModel,
    dialogConfig,
    isProcessing,
    isEditing: !!currentId,
    openCreate,
    openEdit,
    closeModal,
    saveVolume,
    handleInputChange,
    handleModelChange,
    removeModel,
    confirmDelete,
    closeDialog
  };
};