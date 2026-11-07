import { useCallback, useEffect, useMemo, useState } from 'react';
import { CirclePlay } from 'lucide-react';
import { SectionCard } from '@/components/common/ui';
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
    const currentValue = helpKey === 'original' ? (parameters.fibers_per_group === null ? 1 : 0) : helpKey === 'fibers_per_group' ? (parameters.fibers_per_group ?? [1, 3, 6, 3][parameters.base_technique ?? 1]) : helpKey === 'spread' ? (parameters.spread ?? ((parameters.base_technique ?? 1) === 2 ? style.profile.mega_fan_spread : style.profile.fan_spread)) : helpKey ? (parameters[helpKey as keyof OptionParameters] ?? 1) : 1;
    return <><SectionCard variant="business" title="Así se verá en 3D"><label className="mb-3 block text-xs text-[#605e5c]">Estilo de prueba<select aria-label="Estilo de prueba" className="mt-1 w-full rounded-sm border border-[#edebe9] bg-white px-2 py-2 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>{styles.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label><Lash3DPreview profile={demo.profile} selection={demo.selection} options={demo.options}/><p className="my-3 text-xs text-[#605e5c]">Cambia los valores del formulario para ver el resultado en esta pestaña.</p><button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[#094732] px-3 py-2 text-sm text-[#094732] hover:bg-[#eaf4ef]" onClick={() => onHelp(keys[0])}><CirclePlay size={17}/>Ver demostración animada</button></SectionCard>
 {topic && helpKey && <VisualTutorialDialog key={helpKey} topic={topic} currentValue={currentValue} renderDemo={renderDemo} onClose={() => onHelp(null)} stepLabel={keys.length > 1 ? `${index + 1} de ${keys.length}` : undefined} onPrevious={keys.length > 1 ? () => onHelp(keys[(index + keys.length - 1) % keys.length]) : undefined} onNext={keys.length > 1 ? () => onHelp(keys[(index + 1) % keys.length]) : undefined}/>}</>;
}
