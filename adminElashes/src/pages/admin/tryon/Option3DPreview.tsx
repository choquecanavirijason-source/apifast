import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CirclePlay } from 'lucide-react';
import { EditorSection, fieldInput, fieldLabel } from './tryonUi';
import { TryOnService } from '@/core/services/tryon/tryon.service';
import type { OptionKind, OptionParameters, RenderProfile } from '@/core/services/tryon/tryon.service';
import raw from '@/core/config/tryon-templates.json';
import Lash3DPreview from './Lash3DPreview';
import VisualTutorialDialog from './VisualTutorialDialog';
import { optionHelpDemo, optionPreviewDemo, optionHelpKeys, optionHelpTopics } from './optionPreview';
import type { OptionHelpKey } from './optionPreview';
const templates = raw.templates as Record<string, RenderProfile>;
const defaults = raw.styles.map(s => ({ key: s.key, name: s.name, profile: templates[s.key] }));
export default function Option3DPreview({ kind, parameters, helpKey, onHelp }: {
    kind: OptionKind;
    parameters: OptionParameters;
    helpKey: OptionHelpKey | null;
    onHelp: (key: OptionHelpKey | null) => void;
}) {
    const [styles, setStyles] = useState(defaults), [selected, setSelected] = useState('cateye');
    useEffect(() => {
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
    return <><EditorSection title="Así se verá en 3D" icon={<Box size={15}/>} bodyClassName="p-4"><label className={`${fieldLabel} mb-3`}>Estilo de prueba<select aria-label="Estilo de prueba" className={`${fieldInput} mt-1.5`} value={selected} onChange={e => setSelected(e.target.value)}>{styles.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label><Lash3DPreview profile={demo.profile} selection={demo.selection} options={demo.options}/><p className="my-3 text-xs text-[#605e5c]">Cambia los valores del formulario para ver el resultado en esta pestaña.</p>{keys.length > 0 && <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[#094732] bg-white px-3 py-2 text-sm font-semibold text-[#094732] transition-colors hover:bg-[#eef6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" onClick={() => onHelp(keys[0])}><CirclePlay size={17}/>Ver demostración animada</button>}</EditorSection>
 {topic && helpKey && <VisualTutorialDialog key={helpKey} topic={topic} currentValue={currentValue} renderDemo={renderDemo} onClose={() => onHelp(null)} stepLabel={keys.length > 1 ? `${index + 1} de ${keys.length}` : undefined} onPrevious={keys.length > 1 ? () => onHelp(keys[(index + keys.length - 1) % keys.length]) : undefined} onNext={keys.length > 1 ? () => onHelp(keys[(index + 1) % keys.length]) : undefined}/>}</>;
}
