import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CirclePlay } from 'lucide-react';
import { EditorSection, fieldInput, fieldLabel } from './tryonUi';
import { TryOnService } from '@/core/services/tryon/tryon.service';
import type { OptionKind, OptionParameters, RenderProfile } from '@/core/services/tryon/tryon.service';
import raw from '@/core/config/tryon-templates.json';
import Lash3DPreview from './Lash3DPreview';
import type { PreviewCamera } from './Lash3DPreview';
import { DEFAULT_THUMBNAIL_VIEW, SAMPLE_GROUPS, THUMBNAIL_ASPECT } from './optionThumbnails';
import VisualTutorialDialog from './VisualTutorialDialog';
import { optionHelpDemo, optionPreviewDemo, optionHelpKeys, optionHelpTopics } from './optionPreview';
import type { OptionHelpKey } from './optionPreview';
const templates = raw.templates as Record<string, RenderProfile>;
const defaults = raw.styles.map(s => ({ key: s.key, name: s.name, profile: templates[s.key] }));
/** Vista de la miniatura de la tarjeta de esta opción (solo técnicas). */
export interface ThumbnailControl {
    saved: boolean;
    initial?: PreviewCamera;
    canSave: boolean;
    onSave: (view: PreviewCamera) => void;
    onClear: () => void;
}
export default function Option3DPreview({ kind, parameters, helpKey, onHelp, thumbnail, hidePanel = false }: {
    /** No mostrar el panel 3D: solo los tutoriales de los parámetros. */
    hidePanel?: boolean;
    thumbnail?: ThumbnailControl;
    kind: OptionKind;
    parameters: OptionParameters;
    helpKey: OptionHelpKey | null;
    onHelp: (key: OptionHelpKey | null) => void;
}) {
    const [styles, setStyles] = useState(defaults), [selected, setSelected] = useState('cateye');
    const currentView = useRef<PreviewCamera>(thumbnail?.initial ?? DEFAULT_THUMBNAIL_VIEW), [note, setNote] = useState('');
    useEffect(() => {
        // Las técnicas se ven siempre con el mismo estilo (Cat Eye), igual que sus miniaturas.
        if (thumbnail) return;
        let mounted = true;
        void TryOnService.list().then(rows => {
            if (!mounted)
                return;
            const list = rows.map(r => ({ key: r.style.key, name: r.style.name, profile: r.style.profile ?? templates[r.style.builtin_style ?? 'cateye'] })).filter(s => !!s.profile);
            if (list.length) {
                setStyles(list);
                setSelected(key => list.some(s => s.key === key) ? key : list[0].key);
            }
        }).catch(() => { });
        return () => { mounted = false; };
    }, []);
    const style = styles.find(s => s.key === selected) ?? styles[0];
    const demo = useMemo(() => optionPreviewDemo(style.profile, kind, parameters, style.name), [style, kind, parameters]);
    const keys = optionHelpKeys(kind), topic = helpKey ? optionHelpTopics[helpKey] : null, index = helpKey ? keys.indexOf(helpKey) : 0;
    const renderDemo = useCallback((value: number) => optionHelpDemo(style.profile, kind, parameters, helpKey!, value, style.name), [style, kind, parameters, helpKey]);
    const currentValue = helpKey === 'original' ? (parameters.fibers_per_group === null ? 1 : 0) : helpKey === 'fibers_per_group' ? (parameters.fibers_per_group ?? [1, 3, 6, 3][parameters.base_technique ?? 1]) : helpKey === 'spread' ? (parameters.spread ?? ((parameters.base_technique ?? 1) === 2 ? style.profile.mega_fan_spread : style.profile.fan_spread)) : helpKey ? ((v => typeof v === 'number' ? v : 1)(parameters[helpKey as keyof OptionParameters])) : 1;
    return <>{!hidePanel && <EditorSection title="Así se verá en 3D" icon={<Box size={15}/>} bodyClassName="p-4">{!thumbnail && <label className={`${fieldLabel} mb-3`}>Estilo de prueba<select aria-label="Estilo de prueba" className={`${fieldInput} mt-1.5`} value={selected} onChange={e => setSelected(e.target.value)}>{styles.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>}<Lash3DPreview profile={demo.profile} selection={demo.selection} options={demo.options} sample={thumbnail ? SAMPLE_GROUPS : undefined} aspect={thumbnail ? THUMBNAIL_ASPECT : undefined} initialOrbit={thumbnail ? (thumbnail.initial ?? DEFAULT_THUMBNAIL_VIEW) : undefined} onViewChange={thumbnail ? v => { currentView.current = v; } : undefined}/>{thumbnail && <div className="mt-3 rounded-sm border border-[#e3d6bd] bg-[#faf6ee] p-3 text-xs"><p className="font-semibold text-[#7a6338]">Miniatura de esta técnica</p><p className="mt-1 leading-relaxed text-[#605e5c]">El visor de arriba muestra solo {SAMPLE_GROUPS} grupos, igual que la tarjeta, para que se entienda la técnica sin parecerse a un estilo completo. Gira y acerca el modelo y úsalo como su vista. {thumbnail.saved ? 'Esta técnica ya tiene vista propia.' : 'Ahora usa la vista general.'}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={!thumbnail.canSave} className="rounded-sm border border-[#094732] bg-[#094732] px-3 py-1.5 font-semibold text-white hover:bg-[#0d5b40] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { if (currentView.current) { thumbnail.onSave({ ...currentView.current }); setNote('Vista guardada para la miniatura.'); } }}>Usar esta vista en la miniatura</button>{thumbnail.saved && <button type="button" className="rounded-sm border border-[#d8d5d2] bg-white px-3 py-1.5 font-medium text-[#094732] hover:bg-[#f3f2f1]" onClick={() => { thumbnail.onClear(); setNote('Vuelve a la vista general.'); }}>Quitar vista propia</button>}</div>{!thumbnail.canSave && <p className="mt-2 text-[#605e5c]">Guarda el borrador para poder fijar su miniatura.</p>}<p role="status" className="mt-2 min-h-4 font-medium text-[#094732]">{note}</p></div>}<p className="my-3 text-xs text-[#605e5c]">Cambia los valores del formulario para ver el resultado en esta pestaña.</p>{keys.length > 0 && !thumbnail && <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[#094732] bg-white px-3 py-2 text-sm font-semibold text-[#094732] transition-colors hover:bg-[#eef6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" onClick={() => onHelp(keys[0])}><CirclePlay size={17}/>Ver demostración animada</button>}</EditorSection>}
 {topic && helpKey && <VisualTutorialDialog key={helpKey} sample={(kind === 'technique' && helpKey !== 'density') || kind === 'thickness' ? SAMPLE_GROUPS : undefined} topic={topic} currentValue={currentValue} renderDemo={renderDemo} onClose={() => onHelp(null)} stepLabel={keys.length > 1 ? `${index + 1} de ${keys.length}` : undefined} onPrevious={keys.length > 1 ? () => onHelp(keys[(index + keys.length - 1) % keys.length]) : undefined} onNext={keys.length > 1 ? () => onHelp(keys[(index + 1) % keys.length]) : undefined}/>}</>;
}
