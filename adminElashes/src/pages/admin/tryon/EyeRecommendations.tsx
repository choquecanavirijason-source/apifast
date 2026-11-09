import { useEffect, useState } from 'react';
import { Check, Eye, Hand, Plus, RefreshCw, ScanFace, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/common/layout';
import { Button, SectionCard } from '@/components/common/ui';
import GenericModal from '@/components/common/modal/GenericModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import useAuth from '@/core/hooks/useAuth';
import { TryOnEyeService, TryOnService, tryOnError } from '@/core/services/tryon/tryon.service';
import type { EyeCategory, EyeCategoryDraft, StyleRow, RenderProfile } from '@/core/services/tryon/tryon.service';

import rawTemplates from '@/core/config/tryon-templates.json';
import { profileSvg } from './profilePreview';

function styleThumbnail(row: StyleRow) {
    const profile = row.style.profile ?? (rawTemplates.templates as Record<string, RenderProfile>)[row.style.builtin_style ?? 'cateye'];
    return row.style.thumbnail ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(profileSvg(profile))}`;
}

const criteria: Record<string, string> = {
    ROUND: 'La sugerencia inicial prioriza diseños con énfasis hacia el extremo exterior.',
    ALMOND: 'La sugerencia inicial prioriza perfiles equilibrados entre el centro y el exterior.',
    ELONGATED: 'La sugerencia inicial prioriza diseños con énfasis en la zona central.',
    UPTURNED: 'La inclinación se mide por separado y acompaña a la forma del ojo en la recomendación.',
    DOWNTURNED: 'La sugerencia inicial da peso a la curvatura y reduce el énfasis excesivo en el extremo.',
};

const groups = { shape: 'Forma', tilt: 'Inclinación', lid: 'Párpado y características' };
const input = 'w-full rounded-sm border border-[#d2d0ce] bg-white px-3 py-2 text-sm focus:border-[#094732] focus:outline-none';

function EyeDrawing({ category }: { category: Pick<EyeCategory, 'key' | 'group'> }) {
    const round = category.key === 'ROUND';
    const narrow = category.key === 'ELONGATED';
    const angle = category.key === 'UPTURNED' ? -10 : category.key === 'DOWNTURNED' ? 10 : 0;
    return <svg viewBox="0 0 240 120" aria-hidden="true" className="h-32 w-full">
        <g transform={`rotate(${angle} 120 60)`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={round ? 'M30 65 Q120 -12 210 65 Q120 132 30 65' : narrow ? 'M25 65 Q120 22 215 65 Q120 94 25 65' : 'M25 65 Q120 0 215 65 Q120 108 25 65'} fill="#fff" stroke="#094732" strokeWidth="2.5"/>
            <circle cx="120" cy="60" r={round ? 28 : 22} fill="#e5eee8" stroke="#9f8351" strokeWidth="2"/>
            <circle cx="120" cy="60" r="11" fill="#094732"/><circle cx="113" cy="53" r="4" fill="#fff"/>
            <path d="M40 43 Q120 -5 200 43" stroke="#9f8351" strokeWidth="1.5" opacity={category.group === 'lid' ? 1 : .35}/>
            {[45, 65, 85, 105, 125, 145, 165, 185].map((x, i) => <path key={x} d={`M${x} ${38 + Math.abs(i - 3.5) * 4} l${(i - 3.5) * 1.5} -12`} stroke="#094732" strokeWidth="1.5"/>)}
        </g>
    </svg>;
}

export default function EyeRecommendations() {
    const auth = useAuth(), canManage = auth.isAdmin() || auth.hasPermissionByName('catalog:manage');
    const [rows, setRows] = useState<StyleRow[]>([]), [categories, setCategories] = useState<EyeCategory[]>([]);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [group, setGroup] = useState<'all' | EyeCategory['group']>('all');
    const [advanced, setAdvanced] = useState(false);
    const [opened, setOpened] = useState(false), [record, setRecord] = useState<EyeCategory | null>(null);
    const [draft, setDraft] = useState<EyeCategoryDraft>({ name: '', group: 'lid', description: '', style_keys: [] });
    const [deleting, setDeleting] = useState<EyeCategory | null>(null);
    const [initial, setInitial] = useState(''), [discard, setDiscard] = useState(false), [search, setSearch] = useState('');
    async function load() {
        setLoading(true); setError('');
        try { const [styles, eyes] = await Promise.all([TryOnService.list(), TryOnEyeService.list()]); setRows(styles); setCategories(eyes); }
        catch (e) { setError(tryOnError(e)); }
        finally { setLoading(false); }
    }
    useEffect(() => { void load(); }, []);
    function open(category?: EyeCategory) {
        const value: EyeCategoryDraft = category ? { name: category.name, group: category.group, description: category.description, style_keys: [...category.style_keys] } : { name: '', group: 'lid', description: '', style_keys: [] };
        setRecord(category ?? null); setDraft(value); setInitial(JSON.stringify(value)); setSearch(''); setOpened(true);
    }
    const dirty = JSON.stringify(draft) !== initial;
    function close() { if (busy) return; if (dirty) setDiscard(true); else setOpened(false); }
    async function save() {
        setBusy(true);
        try {
            if (record) await TryOnEyeService.save(record.key, draft, record.revision, Object.fromEntries(rows.map(row => [row.style.key, row.revision])));
            else await TryOnEyeService.create(draft);
            setOpened(false); toast.success('Recomendaciones publicadas'); await load();
        } catch (e) { toast.error(tryOnError(e)); }
        finally { setBusy(false); }
    }
    async function remove() {
        if (!deleting || busy) return;
        setBusy(true);
        try {
            await TryOnEyeService.delete(deleting.key, deleting.revision);
            setDeleting(null);
            setOpened(false);
            toast.success('Característica eliminada');
            await load();
        } catch (e) { toast.error(tryOnError(e)); }
        finally { setBusy(false); }
    }
    function toggle(key: string) { setDraft(value => ({ ...value, style_keys: value.style_keys.includes(key) ? value.style_keys.filter(k => k !== key) : [...value.style_keys, key] })); }
    const available = rows.filter(row => row.published_revision && row.style.is_active);
    return <Layout title="Tipos de ojo y recomendaciones" subtitle="Personaliza qué estilos ofrecer a cada mirada" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex items-center gap-2">{canManage && advanced && <Button variant="secondary" size="sm" leftIcon={<Plus size={14}/>} onClick={() => open()} disabled={loading || !!error}>Nueva característica</Button>}<Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} onClick={() => void load()} disabled={loading}>Actualizar</Button></div>}>
        <div className="mb-5 flex flex-wrap items-center gap-4 border border-[#dce6df] bg-[#edf4ef] p-4"><Eye className="text-[#094732]" size={28}/><div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-[#094732]">Sugerencias automáticas para cada mirada</h2><p className="mt-1 text-sm text-[#52645a]">Crea y publica tus diseños. El probador analiza la mirada y ordena los estilos por su geometría, sin asignar tipos de ojo a cada diseño.</p></div><div className="flex gap-3 text-xs text-[#52645a]"><span className="flex items-center gap-1"><ScanFace size={15}/>Automática</span><span className="flex items-center gap-1"><Hand size={15}/>Manual</span></div></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            ['Forma del ojo', 'Redondo, almendrado y alargado', 'Análisis automático'],
            ['Separación y equilibrio', 'Cercanos, equilibrados o separados; apertura de cada ojo', 'Análisis automático'],
            ['Párpado y profundidad', 'Pliegue visible, encapotado o monólido; hundidos o prominentes', 'Confirmación de la profesional'],
            ['Objetivo de la clienta', 'Natural, abrir, alargar o realzar', 'Selección en la ficha de mirada'],
        ].map(([title, description, source]) => <SectionCard key={title} variant="business" title={title}><p className="text-sm text-[#605e5c]">{description}</p><p className="mt-3 text-xs font-semibold text-[#094732]">{source}</p></SectionCard>)}</div>
        <label className="mb-3 flex items-center gap-2 text-xs text-[#605e5c]"><input type="checkbox" checked={advanced} onChange={e => setAdvanced(e.target.checked)}/>Mostrar opciones manuales avanzadas</label>
        <nav aria-label="Grupos de características" className="mb-5 flex flex-wrap gap-5 border-b border-[#edebe9]">{(['all', 'shape', 'tilt', 'lid'] as const).map(key => <button key={key} onClick={() => setGroup(key)} className={`border-b-2 px-1 py-3 text-sm ${group === key ? 'border-[#094732] font-semibold text-[#094732]' : 'border-transparent text-[#605e5c]'}`}>{key === 'all' ? 'Todas' : groups[key]}</button>)}</nav>
        {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button onClick={() => void load()} className="underline">Reintentar</button></div>}
        {loading ? <p role="status" className="py-6 text-sm">Cargando colección…</p> : !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{categories.filter(c => (advanced || c.detection === 'automatic') && (group === 'all' || c.group === group)).map(category => <SectionCard key={category.key} variant="business" title={category.name}>
            <div className="relative mb-3 border border-[#edf0ec] bg-gradient-to-b from-[#f2f6f2] to-[#fff]"><EyeDrawing category={category}/><span className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 text-[11px] text-[#605e5c]">{groups[category.group]}</span></div>
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#094732]">{category.detection === 'automatic' ? <ScanFace size={14}/> : <Hand size={14}/>}{category.detection === 'automatic' ? 'Detección automática' : 'Selección manual'}</div>
            <p className="min-h-12 text-sm text-[#605e5c]">{category.description || 'Añade una descripción para orientar al salón.'}</p>
            <div className="mt-4 border-t border-[#edebe9] pt-3"><p className="mb-3 text-xs text-[#605e5c]">{category.detection === 'automatic' ? 'Se calcula con cada diseño publicado' : <>{category.style_keys.length} {category.style_keys.length === 1 ? 'estilo recomendado' : 'estilos recomendados'}</>}</p><Button variant="secondary" size="sm" onClick={() => open(category)}>{category.detection === 'automatic' ? 'Ver cómo recomienda' : canManage ? 'Asignar estilos' : 'Ver estilos'}</Button>{canManage && category.detection === 'manual' && <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14}/>} onClick={() => setDeleting(category)} className="ml-2 !text-red-700">Eliminar</Button>}</div>
        </SectionCard>)}{canManage && advanced && <button onClick={() => open()} className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-[#b7c8bd] bg-white p-6 text-center text-[#094732]"><Plus size={28}/><span className="font-semibold">Nueva característica</span><span className="max-w-56 text-xs text-[#605e5c]">Por ejemplo, párpado encapotado o monólido. Disponible por selección manual.</span></button>}</div>}
        {!advanced && group === 'lid' && <SectionCard variant="business" title="Características del párpado"><p className="text-sm text-[#605e5c]">El detector automático actual estima la forma y la inclinación. La evaluación de párpado encapotado o monólido está disponible en las opciones manuales avanzadas.</p></SectionCard>}
        <GenericModal isOpen={opened} onClose={close} title={record ? record.name : 'Nueva característica de ojo'} size="xl" closeOnBackdrop={false} contentClassName="!max-w-[1050px] !max-h-[88dvh] !rounded-sm overflow-hidden" footer={<div className="flex w-full items-center justify-between gap-3"><span className="flex items-center gap-3">{canManage && record?.detection === 'manual' && <Button variant="ghost" size="sm" disabled={busy} leftIcon={<Trash2 size={14}/>} onClick={() => setDeleting(record)} className="!text-red-700">Eliminar</Button>}<span className="text-xs text-[#605e5c]">{record?.detection === 'automatic' ? 'Sugerencias calculadas por la app' : <>{draft.style_keys.length} {draft.style_keys.length === 1 ? 'estilo seleccionado' : 'estilos seleccionados'}</>}</span></span><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={close} disabled={busy}>Cerrar</Button>{canManage && (record?.detection !== 'automatic' || advanced) && <Button variant="secondary" size="sm" onClick={() => void save()} disabled={busy || !dirty || draft.name.trim().length < 2}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Button>}</div></div>}>
            {record?.detection === 'automatic' && <div className="mb-5 border border-[#dce6df] bg-[#edf4ef] p-4"><EyeDrawing category={record}/><h3 className="font-semibold text-[#094732]">Recomendación por geometría</h3><p className="mt-2 text-sm">{criteria[record.key]}</p><p className="mt-2 text-sm text-[#605e5c]">Compara el largo en el centro y el extremo, la curvatura, el barrido y la densidad del diseño. Los estilos nuevos entran automáticamente. Son reglas iniciales para revisar con el salón.</p></div>}
            <fieldset disabled={busy || !canManage || (record?.detection === 'automatic' && !advanced)} className={record?.detection === 'automatic' && !advanced ? 'hidden' : 'space-y-5'}>
                <div className="grid gap-5 md:grid-cols-[220px_1fr]"><div className="border border-[#edebe9] bg-[#f5f8f5]"><EyeDrawing category={record ?? { key: 'manual', group: draft.group }}/><p className="px-4 pb-4 text-xs text-[#52645a]">{record?.detection === 'automatic' ? 'Reconocida por el detector de la app.' : 'El salón la selecciona manualmente en el probador.'}</p></div><div className="space-y-3"><label className="block text-xs">Nombre<input className={`${input} mt-1`} value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><label className="block text-xs">Grupo<select className={`${input} mt-1`} value={draft.group} disabled={record?.detection === 'automatic'} onChange={e => setDraft({ ...draft, group: e.target.value as EyeCategory['group'] })}>{Object.entries(groups).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label><label className="block text-xs">Cómo reconocerlo<textarea className={`${input} mt-1`} value={draft.description} rows={2} maxLength={600} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label></div></div>
                {record?.detection !== 'automatic' && <><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edebe9] pt-4"><div><h3 className="font-semibold">Elige los estilos recomendados</h3><p className="text-xs text-[#605e5c]">Se muestran estilos publicados. Los cambios se reciben al volver a entrar al probador.</p></div><label className="flex items-center gap-2 border border-[#d2d0ce] px-2"><Search size={14}/><input aria-label="Buscar estilo" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estilo" className="w-40 py-2 text-sm outline-none"/></label></div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{available.filter(row => row.style.name.toLowerCase().includes(search.toLowerCase())).map(row => { const selected = draft.style_keys.includes(row.style.key); return <label key={row.style.key} className={`relative cursor-pointer border p-3 ${selected ? 'border-[#094732] bg-[#edf4ef]' : 'border-[#edebe9] bg-white'}`}><input type="checkbox" checked={selected} onChange={() => toggle(row.style.key)} className="absolute right-3 top-3 accent-[#094732]"/><div className="mb-3 flex h-16 items-center justify-center"><img src={styleThumbnail(row)} alt="" className="max-h-16 max-w-28 object-contain"/></div><span className="block pr-4 text-sm font-semibold">{row.style.name}</span><span className="mt-1 flex items-center gap-1 text-xs text-[#605e5c]">{selected && <Check size={12}/>} {selected ? 'Recomendado' : 'Seleccionar'}</span></label>; })}</div>
                {!available.length && <p className="py-4 text-sm text-[#605e5c]">Publica un estilo para poder asignarlo.</p>}
                </>}
                {record?.detection === 'automatic' && <p className="text-xs text-[#605e5c]">La forma y la inclinación son mediciones separadas. El párpado encapotado y otras características siguen disponibles por selección manual mientras se valida su detección.</p>}
            </fieldset>
        </GenericModal>
        <ConfirmDialog isOpen={!!deleting} title="Eliminar característica" message={<>¿Eliminar «{deleting?.name}» y sus asignaciones de recomendaciones? Los diseños de pestañas se conservan.</>} confirmText="Eliminar" cancelText="Cancelar" variant="danger" isProcessing={busy} onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => void remove()}/>
        <ConfirmDialog isOpen={discard} title="Descartar cambios" message="Hay cambios sin publicar en estas recomendaciones." confirmText="Descartar cambios" cancelText="Seguir editando" onCancel={() => setDiscard(false)} onConfirm={() => { setDiscard(false); setOpened(false); }}/>
    </Layout>;
}
