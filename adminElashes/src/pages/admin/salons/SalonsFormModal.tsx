import type { FormEvent } from "react";
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
          <label className="block text-sm font-medium text-slate-700" htmlFor="branch-country">
            Pais
          </label>
          <select
            id="branch-country"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
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
          {errors.department ? <p className="text-xs font-medium text-rose-600">{errors.department}</p> : null}
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
          <label className="block text-sm font-medium text-slate-700" htmlFor="branch-city">
            Ciudad
          </label>
          <select
            id="branch-city"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20 disabled:bg-slate-50 disabled:text-slate-400"
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
          {errors.city ? <p className="text-xs font-medium text-rose-600">{errors.city}</p> : null}
        </div>

        <div className="md:col-span-2 mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || hasValidationErrors}>
            {isEditing ? "Guardar cambios" : "Crear salon"}
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
