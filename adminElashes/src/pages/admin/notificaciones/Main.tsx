import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Megaphone, RefreshCcw } from "lucide-react";
import useAuth from "@/core/hooks/useAuth";
import { SegmentedTabs } from "@/components/common/ui";
import RetoquesTab from "./RetoquesTab";
import CitasTab from "./CitasTab";
import ComunicadosTab from "./comunicados/ComunicadosTab";
import { useBranchSelection } from "./hooks/useBranchSelection";

type Tab = "retoques" | "citas" | "comunicados";

const TABS = [
  { id: "retoques", label: "Estado de retoques", icon: <RefreshCcw /> },
  { id: "citas", label: "Próximas citas", icon: <CalendarClock /> },
  { id: "comunicados", label: "Comunicados", icon: <Megaphone /> },
] as const;

export default function NotificacionesPage() {
  const { isAdmin, hasRole, hasPermissionByName } = useAuth();
  // Admin y Secretaria eligen sucursal; el resto queda en la suya (lo fuerza el backend).
  const canChooseBranch = isAdmin() || hasRole("Secretaria");
  const canManage = isAdmin() || hasPermissionByName("clients:manage");
  const canSendReminder = isAdmin() || hasPermissionByName("reminders:send");
  const canBroadcast = isAdmin() || hasPermissionByName("broadcasts:send");
  const tabOptions = canBroadcast ? TABS : TABS.filter((option) => option.id !== "comunicados");

  // En la URL (?tab=citas) para que la pestaña sobreviva a una recarga.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: Tab = tabOptions.find((option) => option.id === requested)?.id ?? "retoques";
  const setTab = (next: Tab) => setSearchParams(next === "retoques" ? {} : { tab: next }, { replace: true });

  // Las pestañas comparten sucursal y rango de días.
  const branch = useBranchSelection(canChooseBranch);
  const [dias, setDias] = useState(30);

  const tabs = <SegmentedTabs options={tabOptions} value={tab} onChange={setTab} />;
  const shared = { tabs, branch, canChooseBranch };

  if (tab === "comunicados") return <ComunicadosTab {...shared} />;
  if (tab === "citas")
    return <CitasTab {...shared} canSendReminder={canSendReminder} dias={dias} onDiasChange={setDias} />;
  return <RetoquesTab {...shared} canManage={canManage} dias={dias} onDiasChange={setDias} />;
}
