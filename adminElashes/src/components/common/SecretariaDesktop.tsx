import { useNavigate } from "react-router-dom";
import { ReceiptText, Ticket, Users } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ModuleItem = {
  icon: React.ReactNode;
  label: string;
  description: string;
  path: string;
  accent: string;        // color del ícono / borde hover
  accentBg: string;      // fondo del ícono
  accentRing: string;    // ring en hover
};

// ─── Módulos disponibles para secretaria ─────────────────────────────────────

const MODULES: ModuleItem[] = [
  {
    icon: <ReceiptText size={48} strokeWidth={1.5} />,
    label: "Caja POS",
    description: "Registra ventas, pagos y consulta el historial de caja del día.",
    path: "/admin/pos",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-900/40",
    accentRing: "hover:ring-emerald-700/60",
  },
  {
    icon: <Ticket size={48} strokeWidth={1.5} />,
    label: "Tickets",
    description: "Visualiza y gestiona el tablero de atención de clientas.",
    path: "/admin/tickets",
    accent: "text-amber-400",
    accentBg: "bg-amber-900/30",
    accentRing: "hover:ring-amber-700/60",
  },
  {
    icon: <Users size={48} strokeWidth={1.5} />,
    label: "Operarias",
    description: "Consulta el estado y disponibilidad de las operarias en turno.",
    path: "/admin/services/queue",
    accent: "text-sky-400",
    accentBg: "bg-sky-900/30",
    accentRing: "hover:ring-sky-700/60",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function SecretariaDesktop() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12 select-none">

      {/* Encabezado */}
      <div className="mb-12 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-500 mb-2">
          Panel de secretaría
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight">
          ¿Qué vas a gestionar hoy?
        </h1>
        <p className="mt-2 text-sm text-emerald-100/40">
          Selecciona un módulo para comenzar
        </p>
      </div>

      {/* Iconos de escritorio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
        {MODULES.map((mod) => (
          <button
            key={mod.path}
            type="button"
            onClick={() => navigate(mod.path)}
            className={`
              group flex flex-col items-center gap-5 p-8
              rounded-2xl border border-emerald-900/40
              bg-[#0d2318]/70 backdrop-blur-sm
              ring-2 ring-transparent
              transition-all duration-200
              hover:bg-[#0d2318] hover:border-emerald-800/60
              hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40
              active:scale-[0.98]
              ${mod.accentRing}
            `}
            style={{ background: "linear-gradient(145deg, #0d2318 0%, #071510 100%)" }}
          >
            {/* Ícono */}
            <div
              className={`
                flex items-center justify-center
                w-24 h-24 rounded-2xl
                ${mod.accentBg} ${mod.accent}
                transition-transform duration-200
                group-hover:scale-110
              `}
            >
              {mod.icon}
            </div>

            {/* Texto */}
            <div className="text-center">
              <p className={`text-lg font-bold ${mod.accent} mb-1`}>
                {mod.label}
              </p>
              <p className="text-xs text-emerald-100/40 leading-relaxed">
                {mod.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Pie decorativo */}
      <p className="mt-12 text-[11px] text-emerald-900/60 tracking-widest uppercase">
        FaceMapping · Secretaría
      </p>
    </div>
  );
}