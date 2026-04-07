import React, { useState, useMemo } from "react";
import { 
  Plus, Search, Eye, FilterX, Calendar, ClipboardList, X, Check 
} from "lucide-react";

const RETIRO_DIAS = 21;

const calcularFechaRetiro = (applicationDate: string, dias = RETIRO_DIAS) => {
  if (!applicationDate) return "";
  const date = new Date(`${applicationDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + dias);
  return date.toISOString().split("T")[0];
};

const calcularDiasRestantes = (targetDate: string) => {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${targetDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

// --- 1. Tipos y Datos Mock ---
interface IFollowUp {
  id: number;
  clientId: number;
  clientName: string;
  applicationDate: string;
  diseno: string;
  curva: string[]; // Ejemplo: ['C', 'CC']
  tamano: string[]; // Ejemplo: ['10', '11', '12']
  notas: string;
}

interface IServiceItem {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
}

const MOCK_CLIENTS = [
    { id: 1, name: "Ana García" },
    { id: 2, name: "Lucía Méndez" },
    { id: 3, name: "Carla Ruiz" },
];

const MOCK_FOLLOWUPS: IFollowUp[] = [
  { id: 101, clientId: 1, clientName: "Ana García", applicationDate: "2023-10-25", diseno: "Ojo de Gato", curva: ["C", "CC"], tamano: ["10", "11", "12", "13"], notas: "Usamos adhesivo rápido." },
  { id: 102, clientId: 2, clientName: "Lucía Méndez", applicationDate: "2023-10-26", diseno: "Muñeca", curva: ["D"], tamano: ["9", "10", "11"], notas: "Ojo sensible." },
  { id: 103, clientId: 1, clientName: "Ana García", applicationDate: "2023-11-15", diseno: "Híbrido", curva: ["CC"], tamano: ["11", "12", "13"], notas: "Retoque." },
  { id: 104, clientId: 3, clientName: "Carla Ruiz", applicationDate: "2023-11-18", diseno: "Natural", curva: ["C"], tamano: ["8", "9", "10"], notas: "" },
];

const MOCK_SERVICES: IServiceItem[] = [
  { id: 1, name: "Clasicas 1D", category: "Extension", durationMinutes: 90, price: 180 },
  { id: 2, name: "Hibridas 2D/3D", category: "Extension", durationMinutes: 120, price: 230 },
  { id: 3, name: "Volumen Ruso", category: "Extension", durationMinutes: 150, price: 290 },
  { id: 4, name: "Efecto Kim K", category: "Diseno", durationMinutes: 135, price: 270 },
  { id: 5, name: "Retoque 2 semanas", category: "Mantenimiento", durationMinutes: 75, price: 130 },
  { id: 6, name: "Retoque 3 semanas", category: "Mantenimiento", durationMinutes: 90, price: 160 },
  { id: 7, name: "Lifting de pestanas", category: "Lash Lift", durationMinutes: 60, price: 140 },
  { id: 8, name: "Retiro de extensiones", category: "Retiro", durationMinutes: 30, price: 60 },
];

const emptyForm: IFollowUp = {
    id: 0, clientId: 0, clientName: "", applicationDate: new Date().toISOString().split('T')[0],
    diseno: "", curva: [], tamano: [], notas: ""
};

// --- 2. Componentes UI Internos ---

// Modal Simple
const SimpleModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Tabla Simple
const SimpleDataTable = ({ data, columns, actions }: any) => {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {columns.map((col: any) => (
                  <th key={col.key} className="px-6 py-4 font-bold tracking-wider">
                    {col.header}
                  </th>
                ))}
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length > 0 ? (
                data.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {columns.map((col: any) => (
                      <td key={`${item.id}-${col.key}`} className="px-6 py-4 whitespace-nowrap">
                        {col.render ? col.render(item) : item[col.key]}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {actions.map((action: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => action.onClick(item)}
                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 font-medium text-xs ${
                              action.variant === 'primary' 
                                ? 'bg-emerald-50 text-[#094732] hover:bg-emerald-100' 
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {action.icon}
                            {action.label && <span className="hidden sm:inline">{action.label}</span>}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
};

// --- 3. Página Principal ---

export type FollowUpPageProps = { embedded?: boolean };

export default function FollowUpPage({ embedded = false }: FollowUpPageProps) {
  // Simulando query params o estado global para el filtro de cliente
  // Cambia esto a un ID (ej: 1) para probar el botón "Ver Todos"
  const [activeClientIdFilter, setActiveClientIdFilter] = useState<number | null>(null); 

  const [items, setItems] = useState<IFollowUp[]>(MOCK_FOLLOWUPS);
  const [search, setSearch] = useState("");
  
  // Modal y Formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFollowUp, setCurrentFollowUp] = useState<IFollowUp | null>(null);
  const [form, setForm] = useState<IFollowUp>(emptyForm);
  const [saving, setSaving] = useState(false);

  // --- Lógica de Filtrado ---
  const filteredItems = useMemo(() => {
    let result = items;

    // 1. Filtro por Cliente Específico (si venimos del historial)
    if (activeClientIdFilter) {
        result = result.filter(item => item.clientId === activeClientIdFilter);
    }

    // 2. Filtro por Buscador
    const query = search.toLowerCase();
    if (query) {
        result = result.filter(item => 
            item.clientName.toLowerCase().includes(query) ||
            item.diseno.toLowerCase().includes(query) ||
            item.applicationDate.includes(query) ||
            calcularFechaRetiro(item.applicationDate).includes(query)
        );
    }
    return result;
  }, [items, search, activeClientIdFilter]);

  const retiroEstimadoForm = useMemo(
    () => calcularFechaRetiro(form.applicationDate),
    [form.applicationDate]
  );

  // --- Manejadores ---
  const handleCreate = () => {
    setCurrentFollowUp(null);
    // Si hay un filtro activo, pre-seleccionamos ese cliente
    const preSelectedClient = activeClientIdFilter 
        ? MOCK_CLIENTS.find(c => c.id === activeClientIdFilter) 
        : null;

    setForm({
        ...emptyForm,
        clientId: preSelectedClient?.id || 0,
        clientName: preSelectedClient?.name || ""
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: IFollowUp) => {
    setCurrentFollowUp(item);
    setForm({ ...item });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    setTimeout(() => {
        if (currentFollowUp) {
            setItems(prev => prev.map(i => i.id === currentFollowUp.id ? form : i));
        } else {
            const newId = Math.max(...items.map(i => i.id), 0) + 1;
            setItems(prev => [{ ...form, id: newId }, ...prev]);
        }
        setSaving(false);
        setIsModalOpen(false);
    }, 400);
  };

  // Helper para manejar arrays (Curvas, Tamaños)
  const toggleArrayItem = (field: 'curva' | 'tamano', value: string) => {
    setForm(prev => {
        const currentArray = prev[field];
        if (currentArray.includes(value)) {
            return { ...prev, [field]: currentArray.filter(v => v !== value) };
        } else {
            return { ...prev, [field]: [...currentArray, value].sort() }; // Ordenamos simple
        }
    });
  };

  // --- Configuración de Tabla ---
  const columns = [
    { 
        key: "clientName", 
        header: "Cliente", 
        render: (item: IFollowUp) => <span className="font-bold text-slate-800">{item.clientName}</span> 
    },
    { 
        key: "applicationDate", 
        header: "Fecha", 
        render: (item: IFollowUp) => (
            <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    {item.applicationDate}
                </span>
            </div>
        ) 
    },
    {
        key: "removalDate",
        header: "Retiro estimado",
        render: (item: IFollowUp) => {
            const retiro = calcularFechaRetiro(item.applicationDate);
            const diasRestantes = calcularDiasRestantes(retiro);

            const statusClass =
              diasRestantes === null
                ? "bg-slate-100 text-slate-600"
                : diasRestantes < 0
                ? "bg-rose-100 text-rose-700"
                : diasRestantes <= 3
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700";

            return (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md w-fit">
                  {retiro || "-"}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md w-fit inline-flex items-center gap-1 ${statusClass}`}>
                  <Check className="w-3 h-3" />
                  {diasRestantes === null
                    ? "Sin fecha"
                    : diasRestantes < 0
                    ? `Vencido hace ${Math.abs(diasRestantes)}d`
                    : diasRestantes === 0
                    ? "Le toca hoy"
                    : `Le toca en ${diasRestantes}d`}
                </span>
              </div>
            );
        },
    },
    { 
        key: "diseno", 
        header: "Diseño", 
        render: (item: IFollowUp) => <span className="text-sm text-[#094732] font-medium">{item.diseno || "-"}</span> 
    },
    { 
        key: "resumen", 
        header: "Mapping (Detalles)", 
        render: (item: IFollowUp) => (
            <div className="flex flex-col gap-1">
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <span className="font-bold text-slate-600">C:</span> 
                    {item.curva.length > 0 ? item.curva.join(', ') : '-'}
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                     <span className="font-bold text-slate-600">L:</span>
                     {item.tamano.length > 0 ? `${Math.min(...item.tamano.map(Number))}mm - ${Math.max(...item.tamano.map(Number))}mm` : '-'}
                </div>
            </div>
        ) 
    },
  ];

  const actions = [
    { 
        label: "Ver Ficha", 
        icon: <Eye className="w-4 h-4" />, 
        onClick: (item: IFollowUp) => handleEdit(item), 
        variant: "primary" 
    }
  ];

  return (
    <div
      className={`font-sans ${
        embedded
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent p-0"
          : "min-h-screen bg-slate-50/50 p-6 md:p-10"
      }`}
    >
      {/* Breadcrumb / Header */}
      {!embedded && (
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2">
            <ClipboardList className="h-6 w-6 text-[#094732]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Seguimiento de Tratamientos</h1>
            <p className="text-sm text-slate-500">Historial de aplicaciones y mapping</p>
          </div>
        </div>
      )}

      {/* Contenedor Principal Style Emerald */}
      <div
        className={`rounded-[1.5rem] border border-emerald-100 bg-emerald-50/40 shadow-sm ${
          embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6" : "p-6 md:p-8"
        }`}
      >
        
        {/* Toolbar Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex gap-2 w-full md:w-auto">
               <button 
                 onClick={handleCreate} 
                 className="bg-[#094732] hover:bg-[#063324] text-white font-bold rounded-xl px-6 py-3 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 w-full md:w-auto"
               >
                 <Plus className="w-5 h-5" /> <span>Nuevo Seguimiento</span>
               </button>
               
               {/* Botón para quitar filtro si venimos de historial */}
               {activeClientIdFilter && (
                   <button 
                     onClick={() => setActiveClientIdFilter(null)} 
                     className="bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl px-4 py-3 flex items-center gap-2 transition-all border border-red-100 shadow-sm"
                   >
                       <FilterX className="w-5 h-5" /> <span className="hidden sm:inline">Ver Todos</span>
                   </button>
               )}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por cliente o diseño..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#094732] focus:border-transparent outline-none text-slate-700 shadow-sm placeholder:text-slate-400" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
         </div>

         <div className={embedded ? "min-h-0 flex-1 overflow-auto" : undefined}>
           <SimpleDataTable data={filteredItems} columns={columns} actions={actions} />
         </div>
      </div>

    
      {/* --- Modal Formulario --- */}
      <SimpleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentFollowUp ? "Editar Seguimiento" : "Nuevo Seguimiento"}
      >
         <form onSubmit={handleSave} className="flex flex-col gap-6">
            
            {/* Fila 1: Cliente y Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Cliente</label>
                    <select 
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#094732] outline-none"
                        value={form.clientId}
                        onChange={(e) => {
                            const client = MOCK_CLIENTS.find(c => c.id === Number(e.target.value));
                            setForm({...form, clientId: Number(e.target.value), clientName: client?.name || ""});
                        }}
                    >
                        <option value={0}>Seleccionar Cliente...</option>
                        {MOCK_CLIENTS.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Aplicación</label>
                    <input 
                        type="date"
                        required
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#094732] outline-none"
                        value={form.applicationDate}
                        onChange={(e) => setForm({...form, applicationDate: e.target.value})}
                    />
                </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Fecha estimada de retiro/sacado</label>
                      <div className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-[#094732] font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{retiroEstimadoForm || "Selecciona fecha de aplicacion"}</span>
                        <span className="text-xs font-medium text-emerald-700/80">(aprox. {RETIRO_DIAS} dias)</span>
                      </div>
                    </div>
            </div>

            {/* Fila 2: Diseño */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Diseño Realizado</label>
                <input 
                    type="text"
                    placeholder="Ej. Ojo de Gato, Volumen Russo..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#094732] outline-none"
                    value={form.diseno}
                    onChange={(e) => setForm({...form, diseno: e.target.value})}
                />
            </div>

            {/* Fila 3: Curvas (Multi-select visual) */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Curvas Utilizadas</label>
                <div className="flex flex-wrap gap-2">
                    {['C', 'CC', 'D', 'DD', 'L', 'M'].map(curva => (
                        <button
                            key={curva}
                            type="button"
                            onClick={() => toggleArrayItem('curva', curva)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                                form.curva.includes(curva)
                                ? 'bg-[#094732] text-white border-[#094732] shadow-md'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {curva}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fila 4: Longitudes (Multi-select visual) */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Longitudes (mm)</label>
                <div className="flex flex-wrap gap-2">
                    {['7', '8', '9', '10', '11', '12', '13', '14', '15'].map(size => (
                        <button
                            key={size}
                            type="button"
                            onClick={() => toggleArrayItem('tamano', size)}
                            className={`w-9 h-9 rounded-lg text-sm font-bold border transition-all flex items-center justify-center ${
                                form.tamano.includes(size)
                                ? 'bg-[#094732] text-white border-[#094732] shadow-md'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Notas */}
            <div>
                 <label className="block text-sm font-bold text-slate-700 mb-2">Notas / Adhesivo</label>
                 <textarea 
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#094732] outline-none resize-none"
                    placeholder="Detalles sobre adhesivo, humedad, o reacciones..."
                    value={form.notas}
                    onChange={(e) => setForm({...form, notas: e.target.value})}
                 />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#094732] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/10 hover:bg-[#063324] transform active:scale-95 transition-all disabled:opacity-70"
              >
                {saving ? "Guardando..." : "Guardar Registro"}
              </button>
            </div>
         </form>
      </SimpleModal>

    </div>
  );
}