import type { Dispatch, SetStateAction } from "react";

import GenericModal from "../../../../components/common/modal/GenericModal";

import AgendaByHourPanel from "./AgendaByHourPanel";
import { formatSelectedDateLong, type SlotRow } from "../calendar.utils";

export type AgendaByHourModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onDateChange: (isoDate: string) => void;
  onMonthSync: (isoDate: string) => void;
  agendaStatusFilter: "all" | "available" | "occupied" | "cancelled";
  setAgendaStatusFilter: Dispatch<SetStateAction<"all" | "available" | "occupied" | "cancelled">>;
  availableSlots: number;
  occupiedSlots: number;
  cancelledSlots: number;
  isLoading: boolean;
  filteredAgendaSchedule: SlotRow[];
};

export default function AgendaByHourModal({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  onMonthSync,
  agendaStatusFilter,
  setAgendaStatusFilter,
  availableSlots,
  occupiedSlots,
  cancelledSlots,
  isLoading,
  filteredAgendaSchedule,
}: AgendaByHourModalProps) {
  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={formatSelectedDateLong(selectedDate)}
      size="xl"
      contentClassName="!max-w-[min(96vw,88rem)] w-full max-h-[min(92vh,56rem)] rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-2xl"
      bodyClassName="pt-0"
      showCloseButton
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Ocupado
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Cancelado
        </span>
      </div>
      <AgendaByHourPanel
        selectedDate={selectedDate}
        showDatePicker
        onDateChange={onDateChange}
        onMonthSync={onMonthSync}
        agendaStatusFilter={agendaStatusFilter}
        setAgendaStatusFilter={setAgendaStatusFilter}
        availableSlots={availableSlots}
        occupiedSlots={occupiedSlots}
        cancelledSlots={cancelledSlots}
        isLoading={isLoading}
        filteredAgendaSchedule={filteredAgendaSchedule}
        variant="modal"
      />
    </GenericModal>
  );
}
