import { Link } from 'react-router';
import { useEffect, useId, useMemo, useState } from 'react';
import { CircleHelp, Copy, History, Plus, RefreshCw, Save, UploadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/common/layout';
import { Button, SectionCard } from '@/components/common/ui';
import DataTable from '@/components/common/table/DataTable';
import type { DataTableColumn } from '@/components/common/table/DataTable';
import GenericModal from '@/components/common/modal/GenericModal';
import useAuth from '@/core/hooks/useAuth';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TryOnService, TryOnOptionsService, tryOnError } from '@/core/services/tryon/tryon.service';
import type { RenderProfile, StyleDraft, StyleRow, StyleVersion, OptionGroups } from '@/core/services/tryon/tryon.service';
import rawTemplates from '@/core/config/tryon-templates.json';
import Lash3DPreview from './Lash3DPreview';
import AdjustmentSlider from './AdjustmentSlider';
import StyleHelpDialog from './StyleHelpDialog';
import type { StyleHelpKey } from './styleHelpTopics';
import { thumbnailFromProfile } from './profilePreview';
const templates = rawTemplates.templates as Record<string, RenderProfile>;
const baseNames = rawTemplates.styles.map(s => ({ key: s.key, name: s.name }));
const originalLengths = ['Corto', 'Medio', 'Largo'], baseTechniques = ['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'], originalThicknesses = ['0.05 mm', '0.07 mm', '0.10 mm', '0.15 mm'];
const eyeNames = [['ALMOND', 'Almendrado'], ['ROUND', 'Redondo'], ['UPTURNED', 'Ascendente'], ['DOWNTURNED', 'Descendente']];
const input = 'w-full rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm text-[#323130] focus:border-[#094732] focus:outline-none';
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
type TableRow = StyleRow & {
    id: string;
};
function status(row: StyleRow) { return !row.published_revision ? 'Borrador' : row.revision !== row.published_revision ? 'Cambios sin publicar' : row.style.is_active ? 'Publicado' : 'Desactivado'; }
function NumberField({ label, value, min, max, step = 1, onChange, onHelp }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    onHelp?: () => void;
}) {
    const id = useId();
    if (onHelp)
        return <AdjustmentSlider label={label} value={value} min={min} max={max} step={step} onChange={onChange} help={<button type="button" onClick={onHelp} className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label={`Ayuda: ${label}`} title={`Ver cómo funciona: ${label}`}><CircleHelp size={15}/></button>}/>;
    return <label htmlFor={id} className="block text-xs text-[#605e5c]">{label}<input id={id} type="number" className={`${input} mt-1`} min={min} max={max} step={step} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n))
        onChange(Math.max(min, Math.min(max, step === 1 ? Math.round(n) : n))); }}/></label>;
}
export default function TryOnCatalogPage() {
    const [helpTopic, setHelpTopic] = useState<StyleHelpKey | null>(null);
    const [optionGroups, setOptionGroups] = useState<OptionGroups>({ length: [], technique: [], thickness: [] });
    const optionNames = (kind: keyof OptionGroups, fallback: string[]) => Object.assign([...fallback], Object.fromEntries(optionGroups[kind].map(r => [r.option.id, (r.published ?? r.option).name])));
    const lengths = optionNames('length', originalLengths), techniques = optionNames('technique', baseTechniques), thicknesses = optionNames('thickness', originalThicknesses);
    const activeOptions = (kind: keyof OptionGroups) => optionGroups[kind].flatMap(r => r.published?.is_active ? [r.published] : []);
    const auth = useAuth(), canManage = auth.isAdmin() || auth.hasPermissionByName('catalog:manage');
    const [deleting, setDeleting] = useState<StyleRow | null>(null);
    const [rows, setRows] = useState<StyleRow[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [opened, setOpened] = useState(false), [record, setRecord] = useState<StyleRow | null>(null), [draft, setDraft] = useState<StyleDraft | null>(null), [tab, setTab] = useState<'general' | 'shape' | 'finish' | 'options'>('general');
    const [versions, setVersions] = useState<StyleVersion[]>([]), [showHistory, setShowHistory] = useState(false), [previewSelection, setPreviewSelection] = useState({ length: 1, technique: 0, thickness: 3 });
    useEffect(() => {
        if (draft)
            setPreviewSelection(p => ({ length: draft.allowed_lengths.includes(p.length) ? p.length : draft.allowed_lengths[0], technique: draft.allowed_techniques.includes(p.technique) ? p.technique : draft.allowed_techniques[0], thickness: draft.allowed_thicknesses.includes(p.thickness) ? p.thickness : draft.allowed_thicknesses[0] }));
    }, [draft?.allowed_lengths, draft?.allowed_techniques, draft?.allowed_thicknesses]);
    const [pendingConfirmation, setPendingConfirmation] = useState<'close' | number | null>(null);
    const dirty = !!draft && (!record || JSON.stringify(draft) !== JSON.stringify(record.style));
    const profile = useMemo(() => draft ? (draft.profile ?? templates[draft.builtin_style ?? 'cateye']) : null, [draft]);
    async function load() {
        setLoading(true);
        setError('');
        try {
            const [styles, options] = await Promise.all([TryOnService.list(), TryOnOptionsService.all()]);
            setRows(styles);
            setOptionGroups(options);
        }
        catch (e) {
            setError(tryOnError(e));
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);
    function availableSelection(style: StyleDraft) {
        const updated = copy(style);
        for (const [field, kind] of [['allowed_lengths', 'length'], ['allowed_techniques', 'technique'], ['allowed_thicknesses', 'thickness']] as const) {
            const choices = activeOptions(kind).map(o => o.id);
            const allowed = updated[field].filter(id => choices.includes(id));
            updated[field] = allowed.length ? allowed : choices.slice(0, 1);
            if (!updated[field].includes(updated.defaults[kind]))
                updated.defaults[kind] = updated[field][0];
        }
        return updated;
    }
    function open(row: StyleRow) { const normalized = availableSelection(row.style); setRecord(row); setDraft(normalized); setPreviewSelection(normalized.defaults); setOpened(true); setTab('general'); setShowHistory(false); }
    function close() {
        if (busy)
            return;
        if (dirty) {
            setPendingConfirmation('close');
            return;
        }
        setOpened(false);
        setDraft(null);
    }
    function create(source?: StyleRow) {
        const base = source?.style ?? rawTemplates.styles[0] as StyleDraft;
        const style = availableSelection(base);
        const identity = crypto.getRandomValues(new Uint8Array(16));
        style.key = 'style_' + Array.from(identity, n => n.toString(16).padStart(2, '0')).join('');
        style.name = source ? `${base.name} · copia` : 'Nuevo estilo';
        style.profile = copy(base.profile ?? templates[base.builtin_style ?? 'cateye']);
        style.builtin_style = null;
        style.thumbnail = null;
        style.sort_order = rows.length;
        style.is_active = true;
        setRecord(null);
        setDraft(style);
        setPreviewSelection(style.defaults);
        setOpened(true);
        setTab('general');
        setShowHistory(false);
    }
    function change(patch: Partial<StyleDraft>) { setDraft(d => d ? { ...d, ...patch } : d); }
    function shape(patch: Partial<RenderProfile>) {
        if (!draft || !profile)
            return;
        change({ profile: { ...copy(profile), ...patch } });
    }
    async function save() {
        if (!draft)
            return;
        setBusy(true);
        try {
            const payload = copy(draft);
            if (payload.profile)
                payload.thumbnail = await thumbnailFromProfile(payload.profile, payload.defaults, optionGroups);
            const saved = record ? await TryOnService.save(record.style.key, record.revision, payload) : await TryOnService.create(payload);
            setRecord(saved);
            setDraft(copy(saved.style));
            await load();
            toast.success('Borrador guardado. Publícalo cuando esté listo.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function publish() {
        if (!record || dirty)
            return;
        setBusy(true);
        try {
            const saved = await TryOnService.publish(record.style.key, record.revision);
            setRecord(saved);
            setDraft(copy(saved.style));
            await load();
            toast.success('Publicado. Se actualizará al volver a abrir el probador.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function history() {
        if (!record)
            return;
        setBusy(true);
        try {
            setVersions(await TryOnService.history(record.style.key));
            setShowHistory(true);
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function restore(revision: number, confirmed = false) {
        if (!record)
            return;
        if (dirty && !confirmed) {
            setPendingConfirmation(revision);
            return;
        }
        setBusy(true);
        try {
            const saved = await TryOnService.restore(record.style.key, record.revision, revision);
            setRecord(saved);
            setDraft(copy(saved.style));
            setShowHistory(false);
            await load();
            toast.success('Versión recuperada como borrador. Revisa y publica.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function deleteDraft() {
        if (!deleting)
            return;
        setBusy(true);
        try {
            await TryOnService.deleteDraft(deleting.style.key, deleting.revision);
            setDeleting(null);
            await load();
            toast.success('Borrador eliminado.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    function toggleOption(field: 'allowed_lengths' | 'allowed_techniques' | 'allowed_thicknesses', value: number) {
        if (!draft)
            return;
        const previous = draft[field];
        const next = previous.includes(value) ? previous.filter(i => i !== value) : [...previous, value].sort();
        if (!next.length)
            return;
        const setting = field === 'allowed_lengths' ? 'length' : field === 'allowed_techniques' ? 'technique' : 'thickness';
        change({ [field]: next, defaults: { ...draft.defaults, [setting]: next.includes(draft.defaults[setting]) ? draft.defaults[setting] : next[0] } });
    }
    const columns: DataTableColumn<TableRow>[] = [
        { key: 'name', header: 'Estilo', sortable: true, getValue: r => r.style.name, render: r => <button className="text-left font-semibold text-[#094732] hover:underline" onClick={() => open(r)}>{r.style.name}</button> },
        { key: 'status', header: 'Estado', getValue: status, render: r => <span className="text-xs">{status(r)}</span> },
        { key: 'order', header: 'Orden', sortable: true, getValue: r => r.style.sort_order, render: r => r.style.sort_order },
        { key: 'default', header: 'Configuración inicial', render: r => `${lengths[r.style.defaults.length]} · ${techniques[r.style.defaults.technique]} · ${thicknesses[r.style.defaults.thickness]}` },
        { key: 'revision', header: 'Versión publicada', render: r => r.published_revision ?? '—' },
    ];
    return <Layout title="Estilos y efectos" subtitle="Diseña, prueba y publica la colección que verá el salón" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-[#323130]">Estilos y efectos</h1><p className="text-xs text-[#605e5c]">Los cambios se muestran en la app cuando los publicas.</p></div><div className="flex gap-1">{canManage && <Button className="!rounded-sm" variant="secondary" size="sm" leftIcon={<Plus size={14}/>} disabled={loading || !!error} onClick={() => create()}>Nuevo estilo</Button>}<Button className="!rounded-sm" variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} onClick={() => void load()} disabled={loading}>Actualizar</Button></div></div>}>
  <nav className="mb-4 flex flex-wrap gap-4 text-sm text-[#094732]"><Link to="/tryon/lengths">Gestionar largos</Link><Link to="/tryon/techniques">Gestionar técnicas</Link><Link to="/tryon/thicknesses">Gestionar grosores</Link></nav>
  {error && <div role="alert" className="mb-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => void load()}>Reintentar</button></div>}
  <SectionCard variant="business" bodyClassName="p-0"><DataTable data={rows.map(r => ({ ...r, id: r.style.key }))} columns={columns} loading={loading} globalSearchPlaceholder="Buscar estilo" actions={[{ label: canManage ? 'Editar' : 'Ver', onClick: open }, ...(canManage ? [{ label: 'Duplicar', icon: <Copy size={14}/>, onClick: create }, { label: 'Eliminar borrador', variant: 'danger' as const, onClick: setDeleting, show: (r: TableRow) => !r.published_revision }] : [])]}/></SectionCard>
  <GenericModal isOpen={opened} onClose={close} size="xl" contentClassName="!max-w-[1100px] !max-h-[88dvh] !rounded-sm overflow-hidden" bodyClassName="!bg-[#f3f2f1]" title={record ? draft?.name ?? 'Estilo' : 'Nuevo estilo'} closeOnBackdrop={false} footer={<div className="flex w-full flex-wrap items-center justify-between gap-3"><span className="text-xs text-[#605e5c]">{record ? status(record) : 'Borrador nuevo'}{dirty ? ' · Hay cambios sin guardar' : ''}</span><div className="flex flex-wrap gap-2"><Button className="!rounded-sm" variant="ghost" size="sm" onClick={close} disabled={busy}>Cerrar</Button>{record && <Button className="!rounded-sm" variant="ghost" size="sm" leftIcon={<History size={14}/>} onClick={() => void history()} disabled={busy}>Historial</Button>}{canManage && <><Button className="!rounded-sm" variant="outline" size="sm" leftIcon={<Save size={14}/>} onClick={() => void save()} disabled={busy || !dirty || !draft?.name.trim()}>Guardar borrador</Button><Button className="!rounded-sm" variant="secondary" size="sm" leftIcon={<UploadCloud size={14}/>} onClick={() => void publish()} disabled={busy || dirty || !record || record.published_revision === record.revision}>{busy ? 'Procesando…' : 'Publicar'}</Button></>}</div></div>}>
   {draft && profile && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div><nav className="mb-5 flex flex-wrap border-b border-[#edebe9]" aria-label="Secciones del estilo">{([['general', 'Información'], ['shape', 'Forma de las pestañas'], ['finish', 'Acabado y distribución'], ['options', 'Opciones del salón']] as const).map(([key, name]) => <button key={key} className={`border-b-2 px-4 py-3 text-sm ${tab === key ? 'border-[#094732] font-semibold' : 'border-transparent text-[#605e5c]'}`} onClick={() => setTab(key)}>{name}</button>)}</nav>
    <fieldset disabled={!canManage || busy} className="space-y-5">
     {tab === 'general' && <SectionCard variant="business" title="Información del estilo"><div className="space-y-4"><label className="block text-xs text-[#605e5c]">Nombre<input className={`${input} mt-1`} value={draft.name} maxLength={120} onChange={e => change({ name: e.target.value })}/></label><label className="block text-xs text-[#605e5c]">Descripción<textarea className={`${input} mt-1`} value={draft.description} maxLength={1500} rows={3} onChange={e => change({ description: e.target.value })}/></label><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Orden en el probador" value={draft.sort_order} min={0} max={10000} onChange={v => change({ sort_order: v })}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={e => change({ is_active: e.target.checked })}/>Disponible al publicar</label></div><div><p className="mb-2 text-xs text-[#605e5c]">Ojos recomendados · sin selección, se ofrece para todos</p><div className="flex flex-wrap gap-4">{eyeNames.map(([key, name]) => <label className="flex gap-2 text-sm" key={key}><input type="checkbox" checked={draft.eye_types.includes(key)} onChange={() => change({ eye_types: draft.eye_types.includes(key) ? draft.eye_types.filter(i => i !== key) : [...draft.eye_types, key] })}/>{name}</label>)}</div></div></div></SectionCard>}
     {tab === 'shape' && <>
      <SectionCard variant="business" title="Perfil del diseño"><p className="mb-3 text-xs text-[#605e5c]">Cada punto controla el largo desde el lagrimal hasta la esquina exterior. Puedes partir de una forma y darle tu propio acabado.</p><label className="block text-xs text-[#605e5c]">Partir de otro estilo<select className={`${input} mt-1 mb-4`} value="" onChange={e => {
                    if (e.target.value)
                        change({ profile: copy(templates[e.target.value]) });
                }}><option value="">Elegir una base…</option>{baseNames.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}</select></label>{draft.profile === null && <p className="mb-4 border-l-2 border-[#9F8351] pl-3 text-xs text-[#605e5c]">Se conserva la forma original aprobada hasta que edites su perfil.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{profile.length_profile.map((p, i) => <label className="text-xs text-[#605e5c]" key={i}>{i === 0 ? 'Lagrimal' : i === profile.length_profile.length - 1 ? 'Extremo exterior' : `Zona ${Math.round(p.t * 100)}%`} · {Math.round(p.length * 100)}<input aria-label={`Largo zona ${i}`} type="range" className="mt-2 block w-full accent-[#094732]" min={.08} max={1.2} step={.005} value={p.length} onChange={e => shape({ length_profile: profile.length_profile.map((point, j) => j === i ? { ...point, length: Number(e.target.value) } : point) })}/></label>)}</div>
      {draft.builtin_style && draft.profile && <Button className="!rounded-sm mt-4" variant="ghost" size="sm" onClick={() => change({ profile: null })}>Recuperar forma original</Button>}</SectionCard>
     </>}
     {tab === 'finish' && <SectionCard variant="business" title="Acabado y distribución"><div className="grid gap-4 sm:grid-cols-3"><NumberField onHelp={() => setHelpTopic('curl')} label="Curvatura" value={profile.curl} min={0} max={1.2} step={.02} onChange={v => shape({ curl: v })}/><NumberField onHelp={() => setHelpTopic('fan')} label="Apertura del abanico" value={profile.fan} min={0} max={35} onChange={v => shape({ fan: v })}/><NumberField onHelp={() => setHelpTopic('sweep')} label="Barrido hacia la sien" value={profile.sweep} min={-40} max={40} onChange={v => shape({ sweep: v })}/><NumberField onHelp={() => setHelpTopic('spike_every')} label="Pico cada N grupos (0: sin picos)" value={profile.spike_every} min={0} max={16} onChange={v => shape({ spike_every: v, spike_offset: v ? Math.min(profile.spike_offset, v - 1) : 0 })}/><NumberField onHelp={() => setHelpTopic('spike_multiplier')} label="Altura relativa del pico" value={profile.spike_multiplier} min={.5} max={2.5} step={.05} onChange={v => shape({ spike_multiplier: v })}/><NumberField onHelp={() => setHelpTopic('width_multiplier')} label="Presencia de las fibras" value={profile.width_multiplier} min={.4} max={1.8} step={.05} onChange={v => shape({ width_multiplier: v })}/><NumberField onHelp={() => setHelpTopic('fan_spread')} label="Apertura en volumen" value={profile.fan_spread} min={0} max={24} onChange={v => shape({ fan_spread: v })}/><NumberField onHelp={() => setHelpTopic('mega_fan_spread')} label="Apertura en megavolumen" value={profile.mega_fan_spread} min={0} max={24} onChange={v => shape({ mega_fan_spread: v })}/></div><p className="mt-4 text-xs text-[#605e5c]">Grupos por técnica. El sistema limita las fibras para mantener la fluidez.</p><div className="mt-3 grid gap-4 sm:grid-cols-4">{baseTechniques.map((name, i) => <NumberField onHelp={() => setHelpTopic(`roots_${i}` as StyleHelpKey)} key={name} label={name} value={profile.roots[i]} min={8} max={[120, 80, 40, 120][i]} onChange={v => shape({ roots: profile.roots.map((n, j) => j === i ? v : n) })}/>)}</div></SectionCard>}

     {tab === 'options' && <SectionCard variant="business" title="Combinaciones disponibles"><div className="space-y-6">{([['allowed_lengths', 'length', 'Largo', lengths], ['allowed_techniques', 'technique', 'Técnica', techniques], ['allowed_thicknesses', 'thickness', 'Grosor', thicknesses]] as const).map(([field, setting, label, options]) => <div key={field}><h3 className="mb-3 text-sm font-semibold">{label}</h3><div className="flex flex-wrap gap-4">{activeOptions(setting).map(({ name, id: i }) => <label className="flex items-center gap-2 text-sm" key={i}><input type="checkbox" checked={draft[field].includes(i)} onChange={() => toggleOption(field, i)}/>{name}</label>)}</div><label className="mt-3 block text-xs text-[#605e5c]">Selección inicial<select className={`${input} mt-1 max-w-xs`} value={draft.defaults[setting]} onChange={e => change({ defaults: { ...draft.defaults, [setting]: Number(e.target.value) } })}>{draft[field].map(i => <option key={i} value={i}>{options[i]}</option>)}</select></label></div>)}</div></SectionCard>}
    </fieldset></div>
    <aside className="space-y-4"><SectionCard variant="business" title="Vista previa 3D"><Lash3DPreview profile={profile} selection={previewSelection} options={optionGroups}/><p className="my-4 text-xs text-[#605e5c]">Vista de diseño sobre un párpado de ejemplo. El encaje real se comprueba con la cámara del probador.</p><div className="space-y-3">{([['length', 'Largo', lengths, draft.allowed_lengths], ['technique', 'Técnica', techniques, draft.allowed_techniques], ['thickness', 'Grosor', thicknesses, draft.allowed_thicknesses]] as const).map(([key, label, names, allowed]) => <label className="block text-xs" key={key}>{label}<select className={`${input} mt-1`} value={allowed.includes(previewSelection[key]) ? previewSelection[key] : allowed[0]} onChange={e => setPreviewSelection(p => ({ ...p, [key]: Number(e.target.value) }))}>{allowed.map(i => <option key={i} value={i}>{names[i]}</option>)}</select></label>)}</div></SectionCard><SectionCard variant="business" title="Publicación"><p className="text-sm text-[#605e5c]">Guardar conserva un borrador. Publicar actualiza la colección de la app al volver a abrir el probador.</p><p className="mt-3 text-xs text-[#605e5c]">Las versiones publicadas se conservan en el historial.</p></SectionCard></aside>
   </div>}
   {showHistory && <SectionCard variant="business" title="Versiones publicadas"><div className="space-y-2">{versions.length === 0 ? <p className="text-sm text-[#605e5c]">Todavía no se ha publicado este estilo.</p> : versions.map(v => <div className="flex flex-wrap justify-between gap-2 border-b border-[#edebe9] py-2 text-sm" key={v.revision}><span>Versión {v.revision} · {new Date(v.published_at).toLocaleString()}</span>{canManage && <Button className="!rounded-sm" variant="ghost" size="sm" disabled={busy} onClick={() => void restore(v.revision)}>Recuperar como borrador</Button>}</div>)}</div></SectionCard>}
  </GenericModal>
  {helpTopic && profile && <StyleHelpDialog key={helpTopic} topicKey={helpTopic} profile={profile} onClose={() => setHelpTopic(null)} onTopicChange={setHelpTopic}/>}
  <ConfirmDialog isOpen={pendingConfirmation !== null} title="¿Descartar cambios?" message={pendingConfirmation === 'close' ? 'Hay cambios sin guardar. Si cierras, se perderán los cambios de este formulario.' : 'Al recuperar esta versión se reemplazarán los cambios sin guardar del formulario.'} confirmText={pendingConfirmation === 'close' ? 'Descartar cambios' : 'Descartar y recuperar'} cancelText="Seguir editando" variant="danger" onCancel={() => setPendingConfirmation(null)} onConfirm={() => {
            const action = pendingConfirmation;
            setPendingConfirmation(null);
            if (action === 'close') {
                setOpened(false);
                setDraft(null);
            }
            else if (typeof action === 'number') {
                void restore(action, true);
            }
        }}/>
  <ConfirmDialog isOpen={!!deleting} title="Eliminar borrador" message={`Se eliminará el borrador ${deleting?.style.name ?? ''}.`} variant="danger" confirmText="Eliminar" onConfirm={() => void deleteDraft()} onCancel={() => {
            if (!busy)
                setDeleting(null);
        }} isProcessing={busy}/>

 </Layout>;
}
