import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import GenericModal from "../../../../components/common/modal/GenericModal";
import { Button } from "../../../../components/common/ui";
import {
  SECTION_PALETTE,
  type StationSection,
} from "../../../../core/hooks/useStationSections";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sections: StationSection[];
  onSave: (sections: StationSection[]) => void;
};

function generateId() {
  return `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function StationSectionsModal({ isOpen, onClose, sections, onSave }: Props) {
  const [draft, setDraft] = useState<StationSection[]>(() =>
    sections.map((s) => ({ ...s }))
  );

  const totalStations = draft.reduce((sum, s) => sum + s.count, 0);

  const handleAdd = () => {
    const palette = SECTION_PALETTE[draft.length % SECTION_PALETTE.length];
    setDraft((prev) => [
      ...prev,
      {
        id: generateId(),
        label: `Sección ${prev.length + 1}`,
        count: 2,
        ...palette,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setDraft((prev) => prev.filter((s) => s.id !== id));
  };

  const handleChange = (id: string, field: keyof StationSection, value: string | number) => {
    setDraft((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleColorPick = (id: string, paletteIdx: number) => {
    const p = SECTION_PALETTE[paletteIdx];
    setDraft((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, headerBg: p.headerBg, headerText: p.headerText, labelBg: p.labelBg } : s
      )
    );
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleClose = () => {
    setDraft(sections.map((s) => ({ ...s })));
    onClose();
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Configurar secciones de trabajo"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Define los grupos de puestos por tipo de servicio. Cada sección agrupa columnas
          consecutivas en el calendario. Los cambios se aplican al guardar.
        </p>

        {/* Resumen */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">Total de puestos:</span>
          <span className="font-bold text-slate-800">{totalStations}</span>
          <span className="text-slate-400">·</span>
          <div className="flex flex-wrap gap-1">
            {draft.map((s, idx) => {
              const from = draft.slice(0, idx).reduce((sum, x) => sum + x.count, 0) + 1;
              const to = from + s.count - 1;
              return (
                <span
                  key={s.id}
                  style={{ background: s.headerBg, color: s.headerText }}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  {from}–{to} {s.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Lista de secciones */}
        <div className="space-y-3">
          {draft.map((section, idx) => {
            const from = draft.slice(0, idx).reduce((sum, x) => sum + x.count, 0) + 1;
            const to = from + section.count - 1;
            return (
              <div
                key={section.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                  <span
                    style={{ background: section.headerBg, color: section.headerText }}
                    className="rounded px-2 py-0.5 text-[10px] font-bold"
                  >
                    Puestos {from}–{to}
                  </span>
                  <span className="flex-1" />
                  {draft.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(section.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar sección"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Nombre */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={section.label}
                      onChange={(e) => handleChange(section.id, "label", e.target.value)}
                      className="h-8 w-full rounded border border-slate-300 px-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      placeholder="Nombre de la sección"
                    />
                  </div>

                  {/* Número de puestos */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Nº de puestos
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={section.count}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(12, Number(e.target.value)));
                        handleChange(section.id, "count", v);
                      }}
                      className="h-8 w-full rounded border border-slate-300 px-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                </div>

                {/* Paleta de colores */}
                <div className="mt-2">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SECTION_PALETTE.map((p, pIdx) => {
                      const isActive =
                        section.headerBg === p.headerBg && section.headerText === p.headerText;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          title={p.name}
                          onClick={() => handleColorPick(section.id, pIdx)}
                          style={{ background: p.headerBg, color: p.headerText, borderColor: p.headerText }}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                            isActive ? "ring-2 ring-slate-700 ring-offset-1" : "opacity-70 hover:opacity-100"
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Agregar sección */}
        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar sección
        </button>

        {/* Acciones */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={draft.length === 0 || draft.some((s) => !s.label.trim())}
          >
            Guardar secciones
          </Button>
        </div>
      </div>
    </GenericModal>
  );
}
