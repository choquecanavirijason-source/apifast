import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import GenericModal from "../../../components/common/modal/GenericModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button, InputField } from "../../../components/common/ui";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import { getSelectedBranchId } from "../../../core/utils/branch";
import type { IClient } from "../../../core/types/IClient";

const COUNTRY_DIAL_CODES = [
  { flag: "🇦🇫", label: "Afganistan", dialCode: "+93" },
  { flag: "🇦🇱", label: "Albania", dialCode: "+355" },
  { flag: "🇩🇪", label: "Alemania", dialCode: "+49" },
  { flag: "🇦🇩", label: "Andorra", dialCode: "+376" },
  { flag: "🇦🇴", label: "Angola", dialCode: "+244" },
  { flag: "🇸🇦", label: "Arabia Saudita", dialCode: "+966" },
  { flag: "🇩🇿", label: "Argelia", dialCode: "+213" },
  { flag: "🇦🇷", label: "Argentina", dialCode: "+54" },
  { flag: "🇦🇲", label: "Armenia", dialCode: "+374" },
  { flag: "🇦🇺", label: "Australia", dialCode: "+61" },
  { flag: "🇦🇹", label: "Austria", dialCode: "+43" },
  { flag: "🇦🇿", label: "Azerbaiyan", dialCode: "+994" },
  { flag: "🇧🇪", label: "Belgica", dialCode: "+32" },
  { flag: "🇧🇾", label: "Bielorrusia", dialCode: "+375" },
  { flag: "🇧🇴", label: "Bolivia", dialCode: "+591" },
  { flag: "🇧🇷", label: "Brasil", dialCode: "+55" },
  { flag: "🇧🇬", label: "Bulgaria", dialCode: "+359" },
  { flag: "🇨🇦", label: "Canada", dialCode: "+1" },
  { flag: "🇨🇱", label: "Chile", dialCode: "+56" },
  { flag: "🇨🇳", label: "China", dialCode: "+86" },
  { flag: "🇨🇾", label: "Chipre", dialCode: "+357" },
  { flag: "🇨🇴", label: "Colombia", dialCode: "+57" },
  { flag: "🇰🇷", label: "Corea del Sur", dialCode: "+82" },
  { flag: "🇨🇷", label: "Costa Rica", dialCode: "+506" },
  { flag: "🇭🇷", label: "Croacia", dialCode: "+385" },
  { flag: "🇨🇺", label: "Cuba", dialCode: "+53" },
  { flag: "🇩🇰", label: "Dinamarca", dialCode: "+45" },
  { flag: "🇪🇨", label: "Ecuador", dialCode: "+593" },
  { flag: "🇪🇬", label: "Egipto", dialCode: "+20" },
  { flag: "🇸🇻", label: "El Salvador", dialCode: "+503" },
  { flag: "🇦🇪", label: "Emiratos Arabes Unidos", dialCode: "+971" },
  { flag: "🇸🇰", label: "Eslovaquia", dialCode: "+421" },
  { flag: "🇸🇮", label: "Eslovenia", dialCode: "+386" },
  { flag: "🇪🇸", label: "Espana", dialCode: "+34" },
  { flag: "🇺🇸", label: "Estados Unidos", dialCode: "+1" },
  { flag: "🇪🇪", label: "Estonia", dialCode: "+372" },
  { flag: "🇵🇭", label: "Filipinas", dialCode: "+63" },
  { flag: "🇫🇮", label: "Finlandia", dialCode: "+358" },
  { flag: "🇫🇷", label: "Francia", dialCode: "+33" },
  { flag: "🇬🇪", label: "Georgia", dialCode: "+995" },
  { flag: "🇬🇷", label: "Grecia", dialCode: "+30" },
  { flag: "🇬🇹", label: "Guatemala", dialCode: "+502" },
  { flag: "🇭🇳", label: "Honduras", dialCode: "+504" },
  { flag: "🇭🇺", label: "Hungria", dialCode: "+36" },
  { flag: "🇮🇳", label: "India", dialCode: "+91" },
  { flag: "🇮🇩", label: "Indonesia", dialCode: "+62" },
  { flag: "🇮🇷", label: "Iran", dialCode: "+98" },
  { flag: "🇮🇪", label: "Irlanda", dialCode: "+353" },
  { flag: "🇮🇸", label: "Islandia", dialCode: "+354" },
  { flag: "🇮🇱", label: "Israel", dialCode: "+972" },
  { flag: "🇮🇹", label: "Italia", dialCode: "+39" },
  { flag: "🇯🇵", label: "Japon", dialCode: "+81" },
  { flag: "🇱🇻", label: "Letonia", dialCode: "+371" },
  { flag: "🇱🇹", label: "Lituania", dialCode: "+370" },
  { flag: "🇱🇺", label: "Luxemburgo", dialCode: "+352" },
  { flag: "🇲🇾", label: "Malasia", dialCode: "+60" },
  { flag: "🇲🇦", label: "Marruecos", dialCode: "+212" },
  { flag: "🇲🇽", label: "Mexico", dialCode: "+52" },
  { flag: "🇳🇮", label: "Nicaragua", dialCode: "+505" },
  { flag: "🇳🇴", label: "Noruega", dialCode: "+47" },
  { flag: "🇳🇿", label: "Nueva Zelanda", dialCode: "+64" },
  { flag: "🇵🇦", label: "Panama", dialCode: "+507" },
  { flag: "🇵🇾", label: "Paraguay", dialCode: "+595" },
  { flag: "🇵🇪", label: "Peru", dialCode: "+51" },
  { flag: "🇵🇱", label: "Polonia", dialCode: "+48" },
  { flag: "🇵🇹", label: "Portugal", dialCode: "+351" },
  { flag: "🇬🇧", label: "Reino Unido", dialCode: "+44" },
  { flag: "🇨🇿", label: "Republica Checa", dialCode: "+420" },
  { flag: "🇩🇴", label: "Republica Dominicana", dialCode: "+1-809" },
  { flag: "🇷🇴", label: "Rumania", dialCode: "+40" },
  { flag: "🇷🇺", label: "Rusia", dialCode: "+7" },
  { flag: "🇸🇪", label: "Suecia", dialCode: "+46" },
  { flag: "🇨🇭", label: "Suiza", dialCode: "+41" },
  { flag: "🇹🇭", label: "Tailandia", dialCode: "+66" },
  { flag: "🇹🇷", label: "Turquia", dialCode: "+90" },
  { flag: "🇺🇦", label: "Ucrania", dialCode: "+380" },
  { flag: "🇺🇾", label: "Uruguay", dialCode: "+598" },
  { flag: "🇻🇪", label: "Venezuela", dialCode: "+58" },
  { flag: "🇻🇳", label: "Vietnam", dialCode: "+84" },
] as const;

interface RegisterClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: HTMLFormElement) => void;
  eyeTypes: EyeTypeOption[];
  branches: Array<{ id: number; name: string }>;
  eyeTypesError: string | null;
  isLoadingEyeTypes: boolean;
  onRetryEyeTypes: () => void;
  mode?: "create" | "edit";
  initialClient?: IClient | null;
  /** Sucursal por defecto (ej. cuando se abre desde POS) */
  defaultBranchId?: number | null;
}

const getInitialPhoneParts = (phone?: string) => {
  if (!phone) {
    return { phone_country_code: "+591", phone: "" };
  }

  const normalized = phone.trim();
  const matchedCountry = [...COUNTRY_DIAL_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => normalized.startsWith(country.dialCode));

  if (matchedCountry) {
    return {
      phone_country_code: matchedCountry.dialCode,
      phone: normalized.slice(matchedCountry.dialCode.length).replace(/\D/g, ""),
    };
  }

  return {
    phone_country_code: "+591",
    phone: normalized.replace(/^\+/, "").replace(/\D/g, ""),
  };
};

export default function RegisterClientModal({
  isOpen,
  onClose,
  onSubmit,
  eyeTypes,
  branches,
  eyeTypesError,
  isLoadingEyeTypes,
  onRetryEyeTypes,
  mode = "create",
  initialClient = null,
  defaultBranchId: defaultBranchIdProp,
}: RegisterClientModalProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [formValues, setFormValues] = useState({
    nombre: "",
    apellido: "",
    edad: "",
    sexo: "",
    phone_country_code: "+591",
    phone: "",
    eye_type_id: "",
    branch_id: "",
  });
  const [fieldErrors, setFieldErrors] = useState({
    nombre: "",
    apellido: "",
    edad: "",
  });
  const bcLabelClass = "block text-xs font-semibold uppercase tracking-wide text-[#605e5c]";
  const bcSelectClass =
    "h-10 w-full rounded-md border border-[#d2d0ce] bg-white px-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20";
  const bcInputClass =
    "!h-10 !rounded-md !border-[#d2d0ce] !text-[#323130] focus:!border-[#0078d4] focus:!ring-[#0078d4]/20";

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmOpen(false);
      setFieldErrors({ nombre: "", apellido: "", edad: "" });
      setFormValues({
        nombre: "",
        apellido: "",
        edad: "",
        sexo: "",
        phone_country_code: "+591",
        phone: "",
        eye_type_id: "",
        branch_id: "",
      });
      return;
    }

    const initialPhone = getInitialPhoneParts(initialClient?.phone);
    const defaultBranchId = defaultBranchIdProp ?? getSelectedBranchId();
    setFieldErrors({ nombre: "", apellido: "", edad: "" });
    setFormValues({
      nombre: initialClient?.nombre ?? "",
      apellido: initialClient?.apellido ?? "",
      edad: initialClient?.edad ? String(initialClient.edad) : "",
      sexo: initialClient?.sexo ?? "",
      phone_country_code: initialPhone.phone_country_code,
      phone: initialPhone.phone,
      eye_type_id: initialClient?.eye_type_id ? String(initialClient.eye_type_id) : "",
      branch_id: initialClient?.branch_id ? String(initialClient.branch_id) : defaultBranchId ? String(defaultBranchId) : "",
    });
  }, [initialClient, isOpen, defaultBranchIdProp]);

  const validateNombre = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "El nombre es obligatorio.";
    if (trimmed.length < 2) return "El nombre debe tener al menos 2 caracteres.";
    return "";
  };

  const validateApellido = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "El apellido es obligatorio.";
    if (trimmed.length < 2) return "El apellido debe tener al menos 2 caracteres.";
    return "";
  };

  const validateEdad = (value: string) => {
    if (!value) return "";
    if (!/^\d+$/.test(value)) return "La edad solo puede contener numeros.";
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return "La edad no puede ser 0.";
    if (parsed > 100) return "La edad no puede ser mayor a 100.";
    return "";
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    if (name === "edad") {
      const normalizedAge = value.replace(/\D/g, "").slice(0, 3);
      setFormValues((prev) => ({ ...prev, edad: normalizedAge }));
      setFieldErrors((prev) => ({ ...prev, edad: validateEdad(normalizedAge) }));
      return;
    }

    if (name === "phone") {
      const normalizedPhone = value.replace(/\D/g, "").slice(0, 15);
      setFormValues((prev) => ({ ...prev, phone: normalizedPhone }));
      return;
    }

    setFormValues((prev) => ({ ...prev, [name]: value }));

    if (name === "nombre") {
      setFieldErrors((prev) => ({ ...prev, nombre: validateNombre(value) }));
    }

    if (name === "apellido") {
      setFieldErrors((prev) => ({ ...prev, apellido: validateApellido(value) }));
    }
  };

  const validateForm = () => {
    const nextErrors = {
      nombre: validateNombre(formValues.nombre),
      apellido: validateApellido(formValues.apellido),
      edad: validateEdad(formValues.edad),
    };
    setFieldErrors(nextErrors);
    return !nextErrors.nombre && !nextErrors.apellido && !nextErrors.edad;
  };

  const handleBeforeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    formRef.current = event.currentTarget;
    setIsConfirmOpen(true);
  };

  const handleConfirmRegister = () => {
    if (!formRef.current) return;

    onSubmit(formRef.current);
    setIsConfirmOpen(false);
  };

  return (
    <>
      <GenericModal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === "edit" ? "Editar Cliente" : "Registrar Cliente"}
        asForm
        onSubmit={handleBeforeSubmit}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField
            name="nombre"
            label="Nombre"
            placeholder="Ingresa el nombre"
            required
            value={formValues.nombre}
            onChange={handleInputChange}
            error={fieldErrors.nombre || undefined}
            className={bcInputClass}
            containerClassName="rounded-md border border-[#edebe9] bg-[#faf9f8] p-3"
          />
          <InputField
            name="apellido"
            label="Apellido"
            placeholder="Ingresa el apellido"
            required
            value={formValues.apellido}
            onChange={handleInputChange}
            error={fieldErrors.apellido || undefined}
            className={bcInputClass}
            containerClassName="rounded-md border border-[#edebe9] bg-[#faf9f8] p-3"
          />

          <InputField
            name="edad"
            type="text"
            inputMode="numeric"
            maxLength={3}
            label="Edad"
            placeholder="Opcional"
            value={formValues.edad}
            onChange={handleInputChange}
            error={fieldErrors.edad || undefined}
            className={bcInputClass}
            containerClassName="rounded-md border border-[#edebe9] bg-[#faf9f8] p-3"
          />

          <div className="space-y-1.5 rounded-md border border-[#edebe9] bg-[#faf9f8] p-3">
            <label className={bcLabelClass} htmlFor="sexo-registro">
              Sexo
            </label>
            <select
              id="sexo-registro"
              name="sexo"
              className={bcSelectClass}
              value={formValues.sexo}
              onChange={handleInputChange}
            >
              <option value="">No especificar</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="space-y-1.5 rounded-md border border-[#edebe9] bg-[#faf9f8] p-3 sm:col-span-2">
            <label className={bcLabelClass} htmlFor="phone-registro">
              Telefono
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,260px)_1fr]">
              <select
                id="phone-country-code"
                name="phone_country_code"
                className={bcSelectClass}
                value={formValues.phone_country_code}
                onChange={handleInputChange}
              >
                {COUNTRY_DIAL_CODES.map((country) => (
                  <option key={`${country.label}-${country.dialCode}`} value={country.dialCode}>
                    {country.flag} {country.label} ({country.dialCode})
                  </option>
                ))}
              </select>

              <InputField
                id="phone-registro"
                name="phone"
                placeholder="Numero (solo digitos)"
                value={formValues.phone}
                onChange={handleInputChange}
                inputMode="numeric"
                maxLength={15}
                className={bcInputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border border-[#edebe9] bg-[#faf9f8] p-3">
            <label className={bcLabelClass} htmlFor="tipo-ojos-registro">
              Tipo de Ojos
            </label>
            <select
              id="tipo-ojos-registro"
              name="eye_type_id"
              className={bcSelectClass}
              value={formValues.eye_type_id}
              onChange={handleInputChange}
              disabled={isLoadingEyeTypes}
            >
              <option value="">No especificar</option>
              {eyeTypes.map((eyeType) => (
                <option key={eyeType.id} value={String(eyeType.id)}>
                  {eyeType.name}
                </option>
              ))}
            </select>
            {isLoadingEyeTypes ? <p className="text-xs text-slate-500">Cargando tipos de ojos...</p> : null}
            {eyeTypesError ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-rose-600">{eyeTypesError}</p>
                <button
                  type="button"
                  onClick={onRetryEyeTypes}
                  className="text-xs font-semibold text-[#0078d4] hover:underline"
                >
                  Reintentar
                </button>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5 rounded-md border border-[#edebe9] bg-[#faf9f8] p-3">
            <label className={bcLabelClass} htmlFor="branch-registro">
              Sucursal
            </label>
            <select
              id="branch-registro"
              name="branch_id"
              className={bcSelectClass}
              value={formValues.branch_id}
              onChange={handleInputChange}
            >
              <option value="">Sin sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-[#edebe9] pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">{mode === "edit" ? "Guardar cambios" : "Registrar"}</Button>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={mode === "edit" ? "Confirmar edicion" : "Confirmar registro"}
        message={
          mode === "edit"
            ? "¿Deseas guardar los cambios de este cliente?"
            : "¿Deseas registrar este cliente con los datos ingresados?"
        }
        confirmText={mode === "edit" ? "Guardar" : "Registrar"}
        cancelText="Cancelar"
        variant="success"
        onConfirm={handleConfirmRegister}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
