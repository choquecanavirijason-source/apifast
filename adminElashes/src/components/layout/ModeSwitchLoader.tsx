import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Store } from "lucide-react";
import type { AppMode } from "@/core/reducer/modeSlice";

interface Props {
  targetMode: AppMode;
  onDone: () => void;
  fading?: boolean;
}

const CONFIG: Record<AppMode, {
  bg: string;
  glow: string;
  accent: string;
  bar: string;
  dots: string;
  label: string;
  sub: string;
}> = {
  salon: {
    bg: "from-[#021a12] via-[#052e1c] to-[#094732]",
    glow: "radial-gradient(ellipse 55% 45% at 50% 38%, #10b981 0%, transparent 68%)",
    accent: "text-emerald-300",
    bar: "bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500",
    dots: "bg-emerald-400",
    label: "Modo Salón",
    sub: "Cargando gestión del salón...",
  },
  marketplace: {
    bg: "from-[#060d1a] via-[#0f1a2e] to-[#1a2d4a]",
    glow: "radial-gradient(ellipse 55% 45% at 50% 38%, #3b82f6 0%, transparent 68%)",
    accent: "text-blue-300",
    bar: "bg-gradient-to-r from-blue-600 via-blue-300 to-blue-600",
    dots: "bg-blue-400",
    label: "Modo Marketplace",
    sub: "Cargando tienda en línea...",
  },
};

const ModeIcon = ({ mode, className }: { mode: AppMode; className?: string }) =>
  mode === "salon"
    ? <Sparkles className={className} />
    : <Store className={className} />;

function Loader({ targetMode, onDone, fading }: Props) {
  const cfg = CONFIG[targetMode];

  // Keep a stable ref so the timeout never restarts when the parent re-renders
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 1520);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — intentional

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${cfg.bg}`}
      style={{
        zIndex: 99999,
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 0.3s ease" : "none",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{ background: cfg.glow }}
      />

      {/* Icon with pulse rings */}
      <div className="relative flex items-center justify-center mb-10 z-10">
        {/* Outer pulse ring */}
        <span className={`absolute h-28 w-28 rounded-full ${cfg.dots} opacity-10 animate-ping`} />
        {/* Middle ring */}
        <span className={`absolute h-20 w-20 rounded-full border ${cfg.dots} opacity-20 animate-pulse`} />
        {/* Icon container */}
        <div className={`relative h-16 w-16 rounded-full flex items-center justify-center ${cfg.accent}`}
          style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(4px)" }}
        >
          <ModeIcon mode={targetMode} className="w-8 h-8 animate-pulse" />
        </div>
      </div>

      {/* Label */}
      <h2 className={`text-2xl font-bold tracking-tight ${cfg.accent} mb-1.5 z-10`}>
        {cfg.label}
      </h2>
      <p className="text-sm text-white/40 mb-10 z-10">{cfg.sub}</p>

      {/* Shimmer bar */}
      <div className="w-56 z-10">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full w-full rounded-full ${cfg.bar} bg-[length:200%_100%]`}
            style={{ animation: "shimmer 1.4s linear infinite" }}
          />
        </div>
        {/* Three bouncing dots */}
        <div className="flex justify-center gap-2 mt-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${cfg.dots}`}
              style={{ animation: `bounce 0.9s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function ModeSwitchLoader({ targetMode, onDone, fading }: Props) {
  return createPortal(
    <Loader targetMode={targetMode} onDone={onDone} fading={fading} />,
    document.body
  );
}
