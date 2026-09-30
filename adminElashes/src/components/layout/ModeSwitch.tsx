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
        className="hidden h-8 items-center gap-0.5 rounded-md border border-white/12 bg-white/8 p-0.5 select-none sm:flex"
        title="Cambiar modo del sistema"
      >
        <button
          type="button"
          onClick={() => handleSwitch("salon")}
          className={`flex h-7 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-all duration-150 sm:px-2 ${
            current === "salon"
              ? "bg-[#ffffff] text-[#094732] shadow-sm"
              : "text-emerald-50/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Modo Salón"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden 2xl:inline">Salón</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitch("marketplace")}
          className={`flex h-7 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-all duration-150 sm:px-2 ${
            current === "marketplace"
              ? "bg-[#ffffff] text-[#094732] shadow-sm"
              : "text-emerald-50/70 hover:bg-white/10 hover:text-white"
          }`}
          title="Modo Marketplace"
        >
          <Store className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden 2xl:inline">Market</span>
        </button>
      </div>
    </>
  );
}
