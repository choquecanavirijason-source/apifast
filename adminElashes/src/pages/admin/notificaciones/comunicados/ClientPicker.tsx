import { useEffect, useState } from "react";
import { Check, Loader2, Mail, Search, Smartphone, X } from "lucide-react";
import {
  BroadcastService,
  MAX_SELECTED_CLIENTS,
  type RecipientCandidate,
} from "@/core/services/broadcast/broadcast.service";
import { fieldClass } from "../notificaciones.utils";

export interface PickedClient {
  id: number;
  name: string;
}

interface ClientPickerProps {
  value: PickedClient[];
  onChange: (value: PickedClient[]) => void;
  branchId: number | null;
  /** Promoción/novedad: avisa cuáles tienen las notificaciones apagadas. */
  isMarketing: boolean;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;
const MIN_TERM = 2;

function Badge({ on, icon: Icon, label }: { on: boolean; icon: typeof Mail; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${
        on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"
      }`}
      title={on ? label : `Sin ${label.toLowerCase()}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/** Buscador por nombre, teléfono, correo o CI; cada resultado dice por qué
 *  canal le puede llegar. Se eligen varias y quedan como chips. */
export default function ClientPicker({ value, onChange, branchId, isMarketing, disabled }: ClientPickerProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<RecipientCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const selectedIds = new Set(value.map((client) => client.id));
  const isFull = value.length >= MAX_SELECTED_CLIENTS;

  useEffect(() => {
    const search = term.trim();
    if (search.length < MIN_TERM) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      BroadcastService.searchClients(search, branchId)
        .then((data) => !cancelled && setResults(data))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setIsSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, branchId]);

  const toggle = (candidate: RecipientCandidate) =>
    onChange(
      selectedIds.has(candidate.id)
        ? value.filter((client) => client.id !== candidate.id)
        : [...value, { id: candidate.id, name: candidate.name }],
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Busca por nombre, teléfono, correo o CI"
          aria-label="Buscar clienta"
          disabled={disabled}
          className={`${fieldClass} w-full pl-9`}
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : null}
      </div>

      {term.trim().length >= MIN_TERM && !isSearching ? (
        <ul className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Ninguna clienta coincide con "{term.trim()}".</li>
          ) : (
            results.map((candidate) => {
              const checked = selectedIds.has(candidate.id);
              const blocked = isMarketing && !candidate.notificaciones_activas;
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(candidate)}
                    disabled={disabled || (!checked && isFull)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-brand bg-brand text-white" : "border-slate-300"
                      }`}
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{candidate.name}</span>
                      <span className="block text-xs text-slate-500">
                        {candidate.branch_name ?? "Sin sucursal"}
                        {blocked ? (
                          <span className="font-medium text-amber-700"> · notificaciones apagadas: no le llegan promociones</span>
                        ) : null}
                      </span>
                    </span>
                    <Badge on={candidate.has_app} icon={Smartphone} label="App" />
                    <Badge on={candidate.has_email} icon={Mail} label="Correo" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {value.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((client) => (
            <span
              key={client.id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700"
            >
              {client.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c.id !== client.id))}
                disabled={disabled}
                aria-label={`Quitar a ${client.name}`}
                className="rounded-full p-0.5 hover:bg-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Quitar todas
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Todavía no elegiste ninguna clienta.</p>
      )}
    </div>
  );
}
