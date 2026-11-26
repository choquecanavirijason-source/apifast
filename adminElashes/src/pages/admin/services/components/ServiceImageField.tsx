import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/bmp";

type Props = {
  imageUrl: string;
  isUploading: boolean;
  label?: string;
  onSelect: (file: File) => void | Promise<void>;
  onRemove: () => void;
};

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Zona de imagen del servicio: arrastrar o elegir, vista previa grande y cambiar/quitar. */
export default function ServiceImageField({ imageUrl, isUploading, label = "Imagen del servicio", onSelect, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const pick = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|bmp)$/i.test(file.type)) {
      setError("Formato no permitido. Usa una imagen JPG, PNG o BMP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`La imagen pesa ${formatBytes(file.size)}. El máximo es 5 MB.`);
      return;
    }
    setError("");
    void onSelect(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={isUploading}
        onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }}
      />

      {imageUrl ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
          <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white sm:w-52">
            <img src={imageUrl} alt="Vista previa de la imagen del servicio" className="h-full w-full object-cover" />
            {isUploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-[#094732]" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-slate-700">Así se verá en el POS y en el catálogo.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Cambiar imagen
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={onRemove}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}
          className={`flex min-h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition ${
            dragging ? "border-[#094732] bg-emerald-50" : "border-slate-300 bg-white hover:border-[#094732]/60 hover:bg-slate-50"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#094732]" />
          ) : (
            <ImagePlus className="h-6 w-6 text-[#094732]" />
          )}
          <span className="text-sm font-semibold text-slate-700">{isUploading ? "Subiendo imagen…" : "Elegir imagen"}</span>
          <span className="text-xs text-slate-500">o arrástrala aquí · JPG, PNG o BMP · hasta 5 MB</span>
        </button>
      )}

      {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
