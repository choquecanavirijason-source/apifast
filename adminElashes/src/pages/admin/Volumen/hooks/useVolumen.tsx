// src/pages/admin/Volumen/hooks/useVolumen.ts
import { useState, useMemo, useEffect } from "react";
import type { LashVolume, VolumenFormState } from "../types";
import api from "@/core/services/api";
import { toast } from "react-toastify";

const emptyForm: VolumenFormState = { name: "", description: "", image: "" };

export const useVolumen = () => {
  const [volumes, setVolumes] = useState<LashVolume[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [form, setForm] = useState<VolumenFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
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
    setForm({ name: volume.name, description: volume.description, image: volume.image });
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

  // --- CRUD (Simulado) ---
  const saveVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      if (currentId) {
        await api.put(`/catalogs/volumes/${currentId}`, {
          name: form.name,
          description: form.description,
          image: form.image || null,
        });
      } else {
        await api.post("/catalogs/volumes", {
          name: form.name,
          description: form.description,
          image: form.image || null,
        });
      }
      await loadVolumes();
      closeModal();
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
    dialogConfig,
    isProcessing,
    isEditing: !!currentId,
    openCreate,
    openEdit,
    closeModal,
    saveVolume,
    handleInputChange,
    confirmDelete,
    closeDialog
  };
};