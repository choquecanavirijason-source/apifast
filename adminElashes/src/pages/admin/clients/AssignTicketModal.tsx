import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { toast } from "react-toastify";
import type { IClient } from "../../../core/types/IClient";
import {
  AgendaService,
  type ServiceOption,
  type TicketItem,
} from "../../../core/services/agenda/agenda.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, InputField } from "../../../components/common/ui";
import { getSelectedBranchId, setSelectedBranchId } from "../../../core/utils/branch";

interface AssignTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: IClient | null;
  onSuccess?: (ticket: TicketItem, totalPrice?: number) => void;
  onSkip?: () => void;
}

const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export default function AssignTicketModal({
  isOpen,
  onClose,
  client,
  onSuccess,
  onSkip,
}: AssignTicketModalProps) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(() => getSelectedBranchId());
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = getLocalDateInputValue();

  useEffect(() => {
    if (!isOpen) return;
    setDate(today);
    setStartTime("09:00");
    setDurationMinutes(60);
    setServiceIds([]);

    const loadServices = async () => {
      setIsLoadingServices(true);
      try {
        const data = await AgendaService.listServices({ limit: 50, branch_id: selectedBranchId ?? undefined });
        setServices(data);
      } catch (error) {
        console.error("Error cargando servicios:", error);
        toast.error("No se pudieron cargar los servicios.");
      } finally {
        setIsLoadingServices(false);
      }
    };
    const loadBranches = async () => {
      try {
        const data = await BranchService.list({ limit: 200 });
        setBranches(data);
        if (!selectedBranchId && data.length > 0) {
          setSelectedBranchIdState(data[0].id);
          setSelectedBranchId(data[0].id);
        }
      } catch (error) {
        console.error("Error cargando sucursales:", error);
        setBranches([]);
      }
    };
    void loadServices();
    void loadBranches();
  }, [isOpen, today, selectedBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    if (serviceIds.length === 0) {
      toast.warning("Selecciona al menos un servicio.");
      return;
    }

    if (!selectedBranchId) {
      toast.warning("Selecciona una sucursal antes de crear el ticket.");
      return;
    }

    const parsedDuration = Number(durationMinutes);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60;

    const startDateTime = new Date(`${date}T${startTime || "09:00"}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    if (endDateTime <= startDateTime) {
      toast.warning("La duración debe ser mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdTicket = await AgendaService.createAppointment({
        client_id: client.id,
        service_ids: serviceIds.length ? serviceIds.map((value) => Number(value)) : null,
        branch_id: selectedBranchId,
        start_time: formatLocalDateTime(startDateTime),
        end_time: formatLocalDateTime(endDateTime),
        status: "pending",
      });

      const totalPrice = serviceIds.length
        ? serviceIds.reduce(
            (sum, id) => sum + (services.find((s) => String(s.id) === id)?.price ?? 0),
            0
          )
        : 0;

      toast.success("Ticket asignado correctamente.");
      onSuccess?.(createdTicket, totalPrice > 0 ? totalPrice : undefined);
      onClose();
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "response" in error
          ? String((error as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "No se pudo asignar el ticket.")
          : "No se pudo asignar el ticket.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onClose();
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions)
      .map((option) => option.value)
      .filter((value) => value);
    setServiceIds(values);
    if (values.length > 0) {
      const duration = values
        .map((value) => services.find((s) => s.id === Number(value))?.duration_minutes ?? 0)
        .reduce((acc, value) => acc + value, 0);
      setDurationMinutes(duration > 0 ? duration : 60);
    }
  };

  if (!client) return null;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title="Asignar ticket"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <Ticket className="h-5 w-5 text-[#094732]" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Cliente: <strong>{client.nombre} {client.apellido}</strong>
            </p>
            <p className="text-xs text-slate-500">El código se genera según el servicio: S1-YYYYMMDD-0001, o TKT-YYYYMMDD-0001 si no hay servicio</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Sucursal</label>
          <select
            name="branch_id"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            value={selectedBranchId ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              const next = Number.isFinite(value) && value > 0 ? value : null;
              setSelectedBranchIdState(next);
              setSelectedBranchId(next);
            }}
          >
            <option value="">Selecciona una sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Servicios *</label>
          <select
            name="service_id"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            value={serviceIds}
            onChange={handleServiceChange}
            disabled={isLoadingServices}
            multiple
            required
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} min · Bs {s.price})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField
            name="date"
            type="date"
            label="Fecha"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <InputField
            name="start_time"
            type="time"
            label="Hora inicio"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>

        <InputField
          name="duration"
          type="number"
          label="Duración (minutos)"
          min={5}
          max={480}
          value={String(durationMinutes)}
          onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleSkip}>
            Omitir
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Asignando…" : "Asignar ticket"}
          </Button>
        </div>
      </form>
    </GenericModal>
  );
}
