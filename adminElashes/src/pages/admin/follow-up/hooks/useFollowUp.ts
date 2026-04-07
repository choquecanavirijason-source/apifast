import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom"; // IMPORTANTE
import { toastify } from "@/core/utils/toastify";
import type { IFollowUp, FollowUpFormState } from "../types";

// Simulamos tu base de datos de clientes (Esto vendría de tu API)
const mockClientsList = [
  { id: 1, nombre: "Carla", apellido: "Ortiz" },
  { id: 2, nombre: "Luis", apellido: "Pérez" },
  { id: 3, nombre: "Maria", apellido: "Gomez" },
];

const defaultFollowUps: IFollowUp[] = [
  {
    id: 1, clientId: 1, clientName: "Carla Ortiz", applicationDate: "2023-10-25",
    curva: ["C", "D"], tamano: ["11", "12"], grosor: ["0.15"], efectoMaterial: "Seda", densidad: "Semitupido", diseno: "Ojo de Gato", formaOjos: ["Almendrados"]
  },
  {
    id: 2, clientId: 2, clientName: "Luis Pérez", applicationDate: "2023-10-20",
    curva: ["C"], tamano: ["10"], grosor: ["0.07"], efectoMaterial: "Visón", densidad: "Natural", diseno: "Natural", formaOjos: ["Caídos"]
  }
];

const emptyForm: FollowUpFormState = {
  clientId: 0, clientName: "", applicationDate: new Date().toISOString().split('T')[0],
  curva: [], tamano: [], grosor: [], efectoMaterial: "", densidad: "", diseno: "", formaOjos: []
};

export const useFollowUp = () => {
  const [items, setItems] = useState<IFollowUp[]>(defaultFollowUps);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [form, setForm] = useState<FollowUpFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Leer parámetros de la URL (?clientId=1)
  const [searchParams] = useSearchParams();
  const filterClientId = searchParams.get("clientId");

  // Filtrado
  const filteredItems = useMemo(() => {
    let data = items;

    // 1. Si venimos del botón "Historial", filtramos solo ese cliente
    if (filterClientId) {
      data = data.filter(i => i.clientId === Number(filterClientId));
    }

    // 2. Buscador normal
    if (search) {
      data = data.filter(i => i.clientName.toLowerCase().includes(search.toLowerCase()));
    }
    
    return data;
  }, [items, search, filterClientId]);

  // Autocompletar el buscador si hay filtro
  useEffect(() => {
    if (filterClientId) {
       const client = mockClientsList.find(c => c.id === Number(filterClientId));
       if (client) setSearch(`${client.nombre} ${client.apellido}`);
    }
  }, [filterClientId]);

  const openCreate = () => {
    setCurrentId(null);
    // Si hay un filtro activo, pre-llenamos el formulario con ese cliente
    if (filterClientId) {
       const client = mockClientsList.find(c => c.id === Number(filterClientId));
       setForm({
         ...emptyForm,
         clientId: Number(filterClientId),
         clientName: client ? `${client.nombre} ${client.apellido}` : ""
       });
    } else {
       setForm(emptyForm);
    }
    setIsModalOpen(true);
  };

  const openEdit = (item: IFollowUp) => {
    setCurrentId(item.id);
    setForm(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setCurrentId(null);
  };

  const handleInputChange = (field: keyof FollowUpFormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: keyof FollowUpFormState, item: string) => {
    setForm(prev => {
      const currentArray = prev[field] as string[];
      if (currentArray.includes(item)) return { ...prev, [field]: currentArray.filter(i => i !== item) };
      return { ...prev, [field]: [...currentArray, item] };
    });
  };

  const saveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setItems(prev => {
        if (currentId) {
          return prev.map(i => i.id === currentId ? { ...form, id: currentId } : i);
        } else {
          const newId = Math.max(...prev.map(i => i.id), 0) + 1;
          return [...prev, { ...form, id: newId }];
        }
      });
      setSaving(false);
      closeModal();
      toastify.success("Seguimiento guardado");
    }, 500);
  };

  return {
    items: filteredItems,
    search, setSearch,
    isModalOpen,
    form,
    saving,
    openCreate, openEdit, closeModal,
    saveFollowUp,
    handleInputChange, toggleArrayItem,
    clientsList: mockClientsList, // Exportamos la lista de clientes
    activeFilter: filterClientId // Exportamos si hay filtro activo
  };
};