import { useMemo, useState } from "react";
import { Layers, Plus, X } from "lucide-react";

import type { ServiceOption } from "../../../../core/services/agenda/agenda.service";

type Props = {
  /** Catálogo completo: de acá salen los servicios que se pueden sumar al combo. */
  services: ServiceOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** Precio de la promoción que se está escribiendo (para mostrar el ahorro). */
  comboPrice: string;
  /** Al editar una promoción, se excluye a sí misma. */
  excludeId?: number;
};

const money = (n: number) => `Bs ${n.toFixed(2)}`;

/** Retoque / retiro de un servicio: solo cuenta si su categoría lo tiene activado y hay días cargados. */
export const followUpOf = (s: ServiceOption) => ({
  maintenance: s.category?.has_maintenance && s.maintenance_days != null ? s.maintenance_days : null,
  removal: s.category?.has_removal && s.removal_days != null ? s.removal_days : null,
});

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

const followUpText = (s: ServiceOption) => {
  const { maintenance, removal } = followUpOf(s);
  const parts = [maintenance != null ? `mantenimiento ${days(maintenance)}` : "", removal != null ? `retiro ${days(removal)}` : ""].filter(Boolean);
  return parts.join(" · ");
};

export const comboTotals = (services: ServiceOption[], ids: number[]) => {
  const byId = new Map(services.map((s) => [s.id, s]));
  const items = ids.map((id) => byId.get(id)).filter((s): s is ServiceOption => Boolean(s));
  return {
    items,
    price: items.reduce((sum, s) => sum + Number(s.effective_price ?? s.price ?? 0), 0),
    minutes: items.reduce((sum, s) => sum + Number(s.duration_minutes ?? 0), 0),
  };
};

export default function ComboComponentsField({ services, selectedIds, onChange, comboPrice, excludeId }: Props) {
  const [pick, setPick] = useState("");

  const eligible = useMemo(
    () => services.filter((s) => !s.is_combo && s.is_active !== false && s.id !== excludeId)
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [services, excludeId],
  );
  const totals = comboTotals(services, selectedIds);
  const price = Number(comboPrice);
  const saving = Number.isFinite(price) && comboPrice.trim() !== "" ? totals.price - price : null;

  const add = () => {
    if (!pick) return;
    onChange([...selectedIds, Number(pick)]);
    setPick("");
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Servicios de la promoción *</p>
          <p className="text-xs text-slate-500">
            Elige los servicios que incluye (mínimo 2). En el POS se vende de un solo toque, pero cada servicio
            se asigna a su operaria y cuenta en los reportes. Puedes repetir un servicio.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={pick}
          onChange={(event) => setPick(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        >
          <option value="">Selecciona un servicio…</option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {money(Number(s.effective_price ?? s.price ?? 0))} · {s.duration_minutes} min
              {followUpText(s) ? ` · ${followUpText(s)}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!pick}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#094732] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#063324] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>

      {totals.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-xs text-slate-400">
          Aún no agregaste servicios.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {totals.items.map((s, index) => (
            <li key={`${s.id}-${index}`} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-slate-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{s.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{s.duration_minutes} min</span>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-slate-700">
                  {money(Number(s.effective_price ?? s.price ?? 0))}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${s.name}`}
                  onClick={() => onChange(selectedIds.filter((_, i) => i !== index))}
                  className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Retoque y retiro: los de ese servicio, que son los que se usan al vender la promoción. */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-7 text-[11px]">
                {followUpOf(s).maintenance != null && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                    Mantenimiento en {days(followUpOf(s).maintenance as number)}
                  </span>
                )}
                {followUpOf(s).removal != null && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                    Retiro en {days(followUpOf(s).removal as number)}
                  </span>
                )}
                {followUpOf(s).maintenance == null && followUpOf(s).removal == null && (
                  <span className="text-slate-400">Sin retoque ni retiro</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600">
          Suma de servicios: <b className="text-slate-800">{money(totals.price)}</b> · Duración total: <b className="text-slate-800">{totals.minutes} min</b>
        </span>
        {saving !== null && totals.items.length > 0 ? (
          saving > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">La clienta ahorra {money(saving)}</span>
          ) : saving < 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
              La promoción cuesta {money(-saving)} más que por separado (no se aplicará descuento)
            </span>
          ) : null
        ) : null}
      </div>
    </div>
  );
}
