import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  BROADCAST_IMAGE_MAX_BYTES,
  BroadcastService,
  type BroadcastImage,
} from "@/core/services/broadcast/broadcast.service";
import { toAbsoluteMediaUrl } from "@/core/services/app-settings/app-settings.service";
import { getApiErrorMessage } from "@/core/utils/apiError";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface BroadcastImageFieldProps {
  value: BroadcastImage | null;
  onChange: (value: BroadcastImage | null) => void;
  disabled?: boolean;
}

/** Sube la imagen apenas se elige, para que la vista previa sea la real. */
export default function BroadcastImageField({ value, onChange, disabled }: BroadcastImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > BROADCAST_IMAGE_MAX_BYTES) {
      toast.error("La imagen pesa más de 1 MB: los celulares no la mostrarían. Achícala e inténtalo de nuevo.");
      return;
    }
    setIsUploading(true);
    try {
      onChange(await BroadcastService.uploadImage(file));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo subir la imagen."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">Imagen (opcional)</span>
      {value ? (
        <div className="relative w-fit">
          <img
            src={toAbsoluteMediaUrl(value.image_url) ?? undefined}
            alt="Imagen del comunicado"
            className="h-24 max-w-xs rounded-lg border border-slate-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Quitar imagen"
            className="absolute -right-2 -top-2 rounded-full bg-slate-800 p-1 text-white shadow hover:bg-slate-700 disabled:opacity-60"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {isUploading ? "Subiendo..." : "Agregar imagen · JPG, PNG o WEBP, máx. 1 MB"}
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(",")} hidden onChange={(e) => void handleFile(e)} />
    </div>
  );
}
