import { ClipboardCheck, Maximize2, Minimize2, Users, UserCheck } from "lucide-react";

import { Button, StatCard } from "../../../../components/common/ui";
import type { ProfessionalForSelect } from "../../../../core/services/agenda/agenda.service";

export type QueueHeaderProps = {
  waitingCount: number;
  inServiceCount: number;
  completedCount: number;
  professionals: ProfessionalForSelect[];
  callProfessionalId: string;
  onCallProfessionalIdChange: (value: string) => void;
  onCallNext: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

export default function QueueHeader({
  waitingCount,
  inServiceCount,
  completedCount,
  professionals,
  callProfessionalId,
  onCallProfessionalIdChange,
  onCallNext,
  isFullscreen,
  onToggleFullscreen,
}: QueueHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-3">
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="En espera" value={waitingCount} icon={<Users className="h-4 w-4" />} tone="amber" />
        <StatCard label="En servicio" value={inServiceCount} icon={<UserCheck className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Finalizadas" value={completedCount} icon={<ClipboardCheck className="h-4 w-4" />} tone="slate" />
      </div>

      <div className="flex min-w-[220px] flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={onToggleFullscreen} aria-label="Pantalla completa">
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
        <select
          value={callProfessionalId}
          onChange={(event) => onCallProfessionalIdChange(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
        >
          <option value="">Auto asignar</option>
          {professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.username}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={onCallNext}>
          Llamar siguiente
        </Button>
      </div>
    </div>
  );
}
