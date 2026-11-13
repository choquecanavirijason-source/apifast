import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, ListChecks, ShieldCheck } from "lucide-react";

import { translatePermission } from "@/core/utils/permissionLabels";
import { moduleInfo, permissionInfo } from "@/core/utils/permissionCatalog";
import type { PermissionItem } from "../types";

interface RolePermissionPickerProps {
  permissions: PermissionItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Selector de permisos con dos pestañas: "Permisos" (cada uno explicado, con el detalle de
 * qué se puede tocar) y "Resumen" (lo que podrá hacer el rol con lo marcado hasta ahora).
 */
export default function RolePermissionPicker({ permissions, selectedIds, onChange }: RolePermissionPickerProps) {
  const [tab, setTab] = useState<"pick" | "summary">("pick");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const groups = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of permissions) {
      const key = p.name.includes(":") ? p.name.split(":")[0] : "otros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const toggle = (id: number) => onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const toggleModule = (items: PermissionItem[]) => {
    const ids = items.map((p) => p.id);
    const all = ids.every((id) => selected.has(id));
    onChange(all ? selectedIds.filter((id) => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])]);
  };
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
      active ? "bg-[#094732] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("pick")} className={tabClass(tab === "pick")}>
          <ShieldCheck className="h-3.5 w-3.5" /> Permisos
        </button>
        <button type="button" onClick={() => setTab("summary")} className={tabClass(tab === "summary")}>
          <ListChecks className="h-3.5 w-3.5" /> Resumen: qué podrá hacer ({selectedIds.length})
        </button>
      </div>

      {tab === "pick" ? (
        <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {groups.map(([module, items]) => {
            const info = moduleInfo(module);
            const count = items.filter((p) => selected.has(p.id)).length;
            const all = count === items.length;
            return (
              <div key={module} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{info.label}</p>
                    {info.description && <p className="text-xs text-slate-500">{info.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleModule(items)}
                    className="shrink-0 text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    {all ? "Quitar todo" : "Marcar todo"} ({count}/{items.length})
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((p) => {
                    const checked = selected.has(p.id);
                    const detail = permissionInfo(p.name);
                    const open = expanded.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border px-3 py-2 transition ${
                          checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(p.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-slate-800">{translatePermission(p.name)}</span>
                            <span className="block text-xs text-slate-500">{detail?.summary ?? "Permiso del sistema."}</span>
                          </span>
                        </label>
                        {detail && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(p.id)}
                              className="ml-6 mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                            >
                              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {open ? "Ocultar detalle" : "¿Qué puede tocar exactamente?"}
                            </button>
                            {open && (
                              <ul className="ml-6 mt-1 space-y-0.5">
                                {detail.can.map((line) => (
                                  <li key={line} className="flex items-start gap-1.5 text-xs text-slate-600">
                                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {selectedIds.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Aún no hay permisos marcados. En la pestaña “Permisos” elige lo que este rol podrá hacer.
            </p>
          ) : (
            groups
              .map(([module, items]) => [module, items.filter((p) => selected.has(p.id))] as const)
              .filter(([, items]) => items.length > 0)
              .map(([module, items]) => (
                <div key={module} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="mb-1 text-sm font-semibold text-slate-700">{moduleInfo(module).label}</p>
                  <ul className="space-y-1">
                    {items.flatMap((p) =>
                      (permissionInfo(p.name)?.can ?? [translatePermission(p.name)]).map((line) => (
                        <li key={`${p.id}-${line}`} className="flex items-start gap-1.5 text-xs text-slate-700">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                          {line}
                        </li>
                      )),
                    )}
                  </ul>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
