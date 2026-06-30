import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Sparkles, Store } from "lucide-react";
import type { AppDispatch, RootState } from "@/store";
import { beginSwitch, commitMode, type AppMode } from "@/core/reducer/modeSlice";
import ModeSwitchLoader from "./ModeSwitchLoader";

const ALLOWED_ROLES = ["SuperAdmin", "Admin", "Secretaria"];

function getRoleName(user: unknown): string {
  if (!user) return "";
  const u = user as { role?: unknown };
  const rv = u.role;
  if (typeof rv === "string") return rv;
  if (rv && typeof rv === "object" && "name" in (rv as Record<string, unknown>)) {
    const n = (rv as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

export default function ModeSwitch() {
  const dispatch = useDispatch<AppDispatch>();
  const current = useSelector((s: RootState) => s.mode.current);
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();

  const [showLoader, setShowLoader] = useState(false);
  const [fading, setFading]         = useState(false);
  const [targetMode, setTargetMode] = useState<AppMode>("salon");

  const canSwitch = ALLOWED_ROLES.includes(getRoleName(user));

  if (!canSwitch) return null;

  const handleSwitch = (next: AppMode) => {
    if (next === current || showLoader) return;
    dispatch(beginSwitch());
    setTargetMode(next);
    setShowLoader(true);
  };

  const handleDone = () => {
    // 1. Commit mode in Redux
    dispatch(commitMode(targetMode));
    // 2. Navigate — new page renders BEHIND the loader (still z-99999)
    navigate(targetMode === "marketplace" ? "/marketplace" : "/");
    // 3. Fade the loader out once the new page has had time to paint
    setFading(true);
    setTimeout(() => {
      setShowLoader(false);
      setFading(false);
    }, 320);
  };

  return (
    <>
      {showLoader && (
        <ModeSwitchLoader targetMode={targetMode} onDone={handleDone} fading={fading} />
      )}

      <div
        className="flex items-center gap-0.5 bg-black/20 rounded-xl p-1 border border-white/10 select-none"
        title="Cambiar modo del sistema"
      >
        <button
          type="button"
          onClick={() => handleSwitch("salon")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            current === "salon"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
          title="Modo Salón"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Salón</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitch("marketplace")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            current === "marketplace"
              ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
          title="Modo Marketplace"
        >
          <Store className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Market</span>
        </button>
      </div>
    </>
  );
}
