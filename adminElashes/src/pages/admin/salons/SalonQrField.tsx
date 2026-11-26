import { useEffect, useMemo, useRef, useState } from "react";
import { History, ImagePlus, QrCode, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/common/ui";

export const QR_MAX_BYTES = 2 * 1024 * 1024;
const QR_ACCEPT = "image/png,image/jpeg,image/webp";

type Props = {
  /** QR guardado hoy en la sucursal (data URL), si hay. */
  currentUrl: string;
  /** Archivo elegido que todavía NO se subió (se sube al guardar la sucursal). */
  file: File | null;
  /** El usuario marcó quitar el QR actual (se aplica al guardar). */
  removed: boolean;
  updatedAt?: string | null;
  updatedByName?: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onRemovedChange: (removed: boolean) => void;
};

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const formatDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function SalonQrField({
  currentUrl, file, removed, updatedAt, updatedByName, disabled, onFileChange, onRemovedChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  // Vista previa local del archivo elegido: se ve ANTES de subirlo.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pick = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(candidate.type)) {
      setError("Formato no permitido. Sube una imagen PNG, JPG o WEBP.");
      return;
    }
    if (candidate.size > QR_MAX_BYTES) {
      setError(`La imagen pesa ${formatBytes(candidate.size)}. El máximo es 2 MB.`);
      return;
    }
    setError("");
    onRemovedChange(false);
    onFileChange(candidate);
  };

  const hasCurrent = Boolean(currentUrl);
  const showingCurrent = hasCurrent && !removed && !file;
  const metaDate = formatDate(updatedAt);

  return (
    <div className="md:col-span-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <QrCode className="h-4 w-4 text-[var(--ui-accent)]" />
        <p className="text-sm font-semibold text-[var(--ui-text)]">QR de pago</p>
      </div>
      <p className="mb-3 text-xs text-[var(--ui-text-muted)]">
        Sube la imagen del QR del negocio (cuenta bancaria, Tigo Money, etc.). Se mostrará en el POS cuando
        la clienta pague con QR. El cambio se aplica al guardar y queda registrado en Auditoría.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={QR_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Zona de carga */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          className={`flex min-h-36 flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition ${
            dragging ? "border-[#094732] bg-[#ecfdf5]" : "border-[var(--ui-border-strong)] bg-white hover:border-[#094732]/60 hover:bg-[#f6faf8]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <ImagePlus className="h-6 w-6 text-[#094732]" />
          <span className="text-sm font-semibold text-[var(--ui-text)]">
            {hasCurrent || file ? "Elegir otra imagen" : "Elegir imagen del QR"}
          </span>
          <span className="text-xs text-[var(--ui-text-muted)]">o arrástrala aquí · PNG, JPG o WEBP · hasta 2 MB</span>
        </button>

        {/* Vista previa */}
        <div className="flex w-full shrink-0 flex-col items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-white p-3 sm:w-52">
          {file ? (
            <>
              <span className="rounded-full bg-[#fff4ce] px-2 py-0.5 text-[10px] font-bold text-[#8a6a1f]">Nuevo · sin guardar</span>
              <img src={previewUrl} alt="Vista previa del QR nuevo" className="h-36 w-36 rounded-md border border-[var(--ui-border)] bg-white object-contain p-1" />
              <p className="max-w-full truncate text-[11px] text-[var(--ui-text-muted)]" title={file.name}>
                {file.name} · {formatBytes(file.size)}
              </p>
            </>
          ) : showingCurrent ? (
            <>
              <span className="rounded-full bg-[#dff6dd] px-2 py-0.5 text-[10px] font-bold text-[#107c10]">QR actual</span>
              <img src={currentUrl} alt="QR de pago actual" className="h-36 w-36 rounded-md border border-[var(--ui-border)] bg-white object-contain p-1" />
            </>
          ) : removed ? (
            <>
              <span className="rounded-full bg-[#fde7e9] px-2 py-0.5 text-[10px] font-bold text-[#d13438]">Se quitará al guardar</span>
              <div className="flex h-36 w-36 items-center justify-center rounded-md border border-dashed border-[var(--ui-border-strong)] text-[var(--ui-text-muted)]">
                <Trash2 className="h-6 w-6" />
              </div>
            </>
          ) : (
            <>
              <span className="rounded-full bg-[var(--ui-surface-muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--ui-text-muted)]">Sin QR</span>
              <div className="flex h-36 w-36 items-center justify-center rounded-md border border-dashed border-[var(--ui-border-strong)] text-[var(--ui-text-muted)]">
                <QrCode className="h-8 w-8 opacity-40" />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {file && (
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => { onFileChange(null); setError(""); }}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Descartar
              </Button>
            )}
            {!file && hasCurrent && !removed && (
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onRemovedChange(true)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Quitar QR
              </Button>
            )}
            {!file && removed && (
              <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onRemovedChange(false)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Deshacer
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-2 text-xs font-medium text-[#a4262c]">{error}</p>}

      {file && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#8a6a1f]">
          <Upload className="h-3.5 w-3.5" />
          Revisa que el QR se vea completo y nítido. Se sube cuando pulses «Guardar cambios».
        </p>
      )}

      {hasCurrent && (updatedByName || metaDate) && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--ui-text-muted)]">
          <History className="h-3.5 w-3.5" />
          Último cambio{updatedByName ? <> por <b className="text-[var(--ui-text)]">{updatedByName}</b></> : null}
          {metaDate ? ` · ${metaDate}` : ""}. El historial completo está en Auditoría.
        </p>
      )}
    </div>
  );
}
