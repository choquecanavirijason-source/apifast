import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, InputField } from "../../../components/common/ui";
import type { SalonForm } from "./utils";

type SalonFormErrors = Partial<Record<keyof SalonForm, string>>;

interface SalonsFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  form: SalonForm;
  errors: SalonFormErrors;
  countryOptions: string[];
  availableCities: string[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onTextChange: (field: keyof SalonForm, value: string) => void;
  onOpeningHoursChange: (
    dayIndex: number,
    rangeIndex: number,
    field: "open_time" | "close_time",
    value: string
  ) => void;
  onAddScheduleRange: (dayIndex: number) => void;
  onRemoveScheduleRange: (dayIndex: number, rangeIndex: number) => void;
  onCountryChange: (value: string) => void;
}

export default function SalonsFormModal({
  isOpen,
  isEditing,
  isSubmitting,
  form,
  errors,
  countryOptions,
  availableCities,
  onClose,
  onSubmit,
  onTextChange,
  onOpeningHoursChange,
  onAddScheduleRange,
  onRemoveScheduleRange,
  onCountryChange,
}: SalonsFormModalProps) {
  const hasValidationErrors = Object.keys(errors).length > 0;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar salon" : "Nueva sucursal"}
      asForm
      onSubmit={onSubmit}
      size="lg"
      closeOnBackdrop={!isSubmitting}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField
          label="Nombre del salon"
          value={form.name}
          onChange={(event) => onTextChange("name", event.target.value)}
          placeholder="Nombre del salon *"
          error={errors.name}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-[#323130]" htmlFor="branch-country">
            Pais
          </label>
          <select
            id="branch-country"
            className="w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
            value={form.department}
            onChange={(event) => onCountryChange(event.target.value)}
            required
          >
            <option value="">Selecciona un pais</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {errors.department ? <p className="text-xs font-semibold text-[#a4262c]">{errors.department}</p> : null}
        </div>

        <InputField
          containerClassName="md:col-span-2"
          label="Direccion"
          value={form.address}
          onChange={(event) => onTextChange("address", event.target.value)}
          placeholder="Direccion"
          error={errors.address}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-[#323130]" htmlFor="branch-city">
            Ciudad
          </label>
          <select
            id="branch-city"
            className="w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
            value={form.city}
            onChange={(event) => onTextChange("city", event.target.value)}
            disabled={!form.department}
            required
          >
            <option value="">{form.department ? "Selecciona una ciudad" : "Selecciona un pais primero"}</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          {errors.city ? <p className="text-xs font-semibold text-[#a4262c]">{errors.city}</p> : null}
        </div>

        <div className="order-last md:col-span-2 mt-2 flex items-center justify-end gap-2 border-t border-[#edebe9] pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || hasValidationErrors}>
            {isEditing ? "Guardar cambios" : "Crear salon"}
          </Button>
        </div>

        <div className="md:col-span-2 mt-1 rounded-sm border border-[#d2d0ce] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#323130]">Horarios de apertura y cierre</p>
            {errors.opening_hours ? (
              <p className="text-xs font-semibold text-[#a4262c]">{errors.opening_hours}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            {form.opening_hours.map((dayItem, dayIndex) => (
              <div key={dayItem.day} className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-[#605e5c]">{dayItem.day}</p>
                  <button
                    type="button"
                    onClick={() => onAddScheduleRange(dayIndex)}
                    disabled={dayItem.ranges.length >= 2}
                    className="inline-flex items-center gap-1 rounded-sm border border-[#8a8886] bg-white px-2 py-1 text-[11px] font-semibold text-[#323130] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar rango
                  </button>
                </div>

                <div className="space-y-1.5">
                  {dayItem.ranges.map((range, rangeIndex) => (
                    <div key={`${dayItem.day}-${rangeIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="13:30"
                        maxLength={5}
                        pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                        value={range.open_time}
                        onChange={(event) =>
                          onOpeningHoursChange(dayIndex, rangeIndex, "open_time", event.target.value)
                        }
                        className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="18:30"
                        maxLength={5}
                        pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                        value={range.close_time}
                        onChange={(event) =>
                          onOpeningHoursChange(dayIndex, rangeIndex, "close_time", event.target.value)
                        }
                        className="h-8 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveScheduleRange(dayIndex, rangeIndex)}
                        className="inline-flex h-8 items-center justify-center rounded-sm border border-[#f1b6b8] bg-[#fff5f5] px-2 text-[#a4262c]"
                        title="Quitar rango"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GenericModal>
  );
}
