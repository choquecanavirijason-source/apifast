import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Cake } from "lucide-react";
import { SectionCard } from "../../../components/common/ui";
import {
  CouponService,
  type BirthdayCouponConfig,
  type BirthdayCouponRedemption,
} from "../../../core/services/coupon/coupon.service";
import { getApiErrorMessage } from "../../../core/utils/apiError";

const fieldClass =
  "h-9 w-full rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 text-sm text-[var(--ui-text)] outline-none transition focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";
const labelClass = "mb-1 block text-xs font-medium text-[var(--ui-text-muted)]";

const EMPTY: BirthdayCouponConfig = { enabled: false, percent: 0, window_days: 0 };

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Configuración del cupón de cumpleaños (solo Admin/SuperAdmin) y registro de sus últimos usos. */
export default function BirthdayCouponSettings() {
  const [saved, setSaved] = useState<BirthdayCouponConfig>(EMPTY);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState("");
  const [windowDays, setWindowDays] = useState("0");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [redemptions, setRedemptions] = useState<BirthdayCouponRedemption[]>([]);

  const applyConfig = useCallback((config: BirthdayCouponConfig) => {
    setSaved(config);
    setEnabled(config.enabled);
    setPercent(config.percent > 0 ? String(config.percent) : "");
    setWindowDays(String(config.window_days));
  }, []);

  const loadRedemptions = useCallback(async () => {
    try {
      setRedemptions(await CouponService.listBirthdayRedemptions(20));
    } catch {
      setRedemptions([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await CouponService.getBirthdayConfig();
        if (!cancelled) applyConfig(config);
        await loadRedemptions();
      } catch (err: unknown) {
        if (!cancelled) setLoadError(getApiErrorMessage(err, "No se pudo cargar la configuración del cupón."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyConfig, loadRedemptions]);

  const percentNumber = Number(percent.replace(",", "."));
  const windowNumber = Number(windowDays);

  const error = useMemo(() => {
    if (percent.trim() !== "" && (!Number.isFinite(percentNumber) || percentNumber < 0 || percentNumber > 100)) {
      return "El descuento debe estar entre 0 y 100 %.";
    }
    if (enabled && !(percentNumber > 0)) return "Para activar el cupón, indica un descuento mayor que 0.";
    if (!Number.isInteger(windowNumber) || windowNumber < 0 || windowNumber > 30) {
      return "Los días de vigencia deben ser un número entero entre 0 y 30.";
    }
    return "";
  }, [enabled, percent, percentNumber, windowNumber]);

  const draft: BirthdayCouponConfig = {
    enabled,
    percent: Number.isFinite(percentNumber) ? percentNumber : 0,
    window_days: Number.isInteger(windowNumber) ? windowNumber : 0,
  };
  const isDirty =
    draft.enabled !== saved.enabled || draft.percent !== saved.percent || draft.window_days !== saved.window_days;

  const handleSave = async () => {
    if (error) {
      toast.warning(error);
      return;
    }
    setIsSaving(true);
    try {
      applyConfig(await CouponService.updateBirthdayConfig(draft));
      toast.success(draft.enabled ? "Cupón de cumpleaños guardado y activo." : "Cupón de cumpleaños guardado (desactivado).");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar el cupón."));
    } finally {
      setIsSaving(false);
    }
  };

  const windowHint =
    windowNumber === 0
      ? "Vale solo el día del cumpleaños."
      : `Vale desde ${windowNumber} día${windowNumber === 1 ? "" : "s"} antes hasta ${windowNumber} día${windowNumber === 1 ? "" : "s"} después del cumpleaños.`;

  return (
    <SectionCard
      title="Cupón de cumpleaños"
      subtitle="Descuento que la cajera puede aplicar en el POS a una clienta en su cumpleaños. Se usa una sola vez por cumpleaños."
      className="mb-3"
      actions={<Cake className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden />}
    >
      {isLoading ? (
        <p className="text-sm text-[var(--ui-text-muted)]">Cargando…</p>
      ) : loadError ? (
        <p className="text-sm font-medium text-rose-600">{loadError}</p>
      ) : (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#094732]"
            />
            Cupón activo
            <span className="text-xs font-normal text-[var(--ui-text-muted)]">
              {enabled ? "El POS lo ofrece a quien cumple años." : "Desactivado: el POS no ofrece nada."}
            </span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="coupon-percent">Descuento (%)</label>
              <input
                id="coupon-percent"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.5"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                placeholder="Ej.: 20"
                className={fieldClass}
              />
              <p className="mt-1 text-[11px] text-[var(--ui-text-muted)]">Se descuenta del total de la venta.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="coupon-window">Días de vigencia alrededor del cumpleaños</label>
              <input
                id="coupon-window"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                step={1}
                value={windowDays}
                onChange={(event) => setWindowDays(event.target.value)}
                className={fieldClass}
              />
              <p className="mt-1 text-[11px] text-[var(--ui-text-muted)]">{windowHint}</p>
            </div>
          </div>

          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

          <div className="flex items-center gap-2 border-t border-[var(--ui-border)] pt-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty || Boolean(error)}
              className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Guardando…" : "Guardar"}
            </button>
            {isDirty ? <span className="text-xs text-[var(--ui-text-muted)]">Hay cambios sin guardar.</span> : null}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">Últimos usos</p>
            {redemptions.length === 0 ? (
              <p className="text-xs text-[var(--ui-text-muted)]">Todavía no se ha usado ningún cupón.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--ui-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Fecha</th>
                      <th className="px-2.5 py-1.5 font-medium">Clienta</th>
                      <th className="px-2.5 py-1.5 font-medium">Venta</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Descuento</th>
                      <th className="px-2.5 py-1.5 font-medium">Aplicó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--ui-border)] text-[var(--ui-text)]">
                        <td className="whitespace-nowrap px-2.5 py-1.5">{formatDateTime(row.created_at)}</td>
                        <td className="px-2.5 py-1.5">{row.client_name}</td>
                        <td className="px-2.5 py-1.5">{row.sale_code ?? "—"}</td>
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums">
                          {row.percent}% · Bs {row.discount_amount.toFixed(2)}
                        </td>
                        <td className="px-2.5 py-1.5">{row.applied_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
