import { Link, useSearchParams } from 'react-router';
import { eyeCategories } from './eyeCategories';
import { useEffect, useId, useMemo, useState } from 'react';
import { Box, CircleHelp, Copy, History, Info, Plus, RefreshCw, RotateCcw, Ruler, Save, SlidersHorizontal, Sparkles, Spline, UploadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/common/layout';
import { Button, SectionCard } from '@/components/common/ui';
import DataTable from '@/components/common/table/DataTable';
import type { DataTableColumn } from '@/components/common/table/DataTable';
import useAuth from '@/core/hooks/useAuth';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TryOnService, TryOnOptionsService, TryOnEyeService, tryOnError } from '@/core/services/tryon/tryon.service';
import type { RenderProfile, StyleDraft, StyleRow, StyleVersion, OptionGroups } from '@/core/services/tryon/tryon.service';
import rawTemplates from '@/core/config/tryon-templates.json';
import Lash3DPreview from './Lash3DPreview';
import AdjustmentSlider from './AdjustmentSlider';
import StyleHelpDialog from './StyleHelpDialog';
import type { StyleHelpKey } from './styleHelpTopics';
import { thumbnailFromProfile } from './profilePreview';
import LashMapEditor from './LashMapEditor';
import LashMapTutorialDialog from './LashMapTutorialDialog';
import { VALIDATED_MAPS } from './lashMap';
import { BrandSwitch, ColorChip, EditorSection, EditorTabs, OptionChip, StatusBadge, TryOnModal, fieldInput, fieldLabel, footerButton, statusTone } from './tryonUi';
const templates = rawTemplates.templates as Record<string, RenderProfile>;
const baseNames = rawTemplates.styles.map(s => ({ key: s.key, name: s.name }));
const originalLengths = ['Corto', 'Medio', 'Largo'], baseTechniques = ['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'], originalThicknesses = ['0.05 mm', '0.07 mm', '0.10 mm', '0.15 mm'];

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
    return <label htmlFor={id} className={fieldLabel}>{label}<input id={id} type="number" className={`${fieldInput} mt-1.5 tabular-nums`} min={min} max={max} step={step} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n))
        onChange(Math.max(min, Math.min(max, step === 1 ? Math.round(n) : n))); }}/></label>;
}
/** Estilos guardados antes del catálogo de colores: solo negro (0). */
function withColors(style: StyleDraft): StyleDraft {
    return { ...style, allowed_colors: style.allowed_colors ?? [0], defaults: { ...style.defaults, color: style.defaults.color ?? 0 } };
}
const allowedColors = (style: StyleDraft) => style.allowed_colors ?? [0];
export default function TryOnCatalogPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [eyeNames, setEyeNames] = useState<string[][]>(eyeCategories.map(category => [category.code, category.name]));
    const [helpTopic, setHelpTopic] = useState<StyleHelpKey | null>(null);
    const [mapTutorial, setMapTutorial] = useState(false);
    const [optionGroups, setOptionGroups] = useState<OptionGroups>({ length: [], technique: [], thickness: [], color: [] });
    const optionNames = (kind: keyof OptionGroups, fallback: string[]) => Object.assign([...fallback], Object.fromEntries((optionGroups[kind] ?? []).map(r => [r.option.id, (r.published ?? r.option).name])));
    const lengths = optionNames('length', originalLengths), techniques = optionNames('technique', baseTechniques), thicknesses = optionNames('thickness', originalThicknesses), colors = optionNames('color', ['Negro']);
    /** Color publicado (o del borrador) de cada opción, para las muestras. */
    const colorHex = (id: number) => { const row = optionGroups.color?.find(r => (r.published ?? r.option).id === id); return (row?.published ?? row?.option)?.parameters.color ?? '#111111'; };
    const activeOptions = (kind: keyof OptionGroups) => (optionGroups[kind] ?? []).flatMap(r => r.published?.is_active ? [r.published] : []);
    const auth = useAuth(), canManage = auth.isAdmin() || auth.hasPermissionByName('catalog:manage');
    const [deleting, setDeleting] = useState<StyleRow | null>(null);
    const [rows, setRows] = useState<StyleRow[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [opened, setOpened] = useState(false), [record, setRecord] = useState<StyleRow | null>(null), [draft, setDraft] = useState<StyleDraft | null>(null), [tab, setTab] = useState<'general' | 'shape' | 'finish' | 'options'>('general');
    const [versions, setVersions] = useState<StyleVersion[]>([]), [showHistory, setShowHistory] = useState(false), [previewSelection, setPreviewSelection] = useState({ length: 1, technique: 0, thickness: 3, color: 0 });
    useEffect(() => {
        if (draft)
            setPreviewSelection(p => ({ length: draft.allowed_lengths.includes(p.length) ? p.length : draft.allowed_lengths[0], technique: draft.allowed_techniques.includes(p.technique) ? p.technique : draft.allowed_techniques[0], thickness: draft.allowed_thicknesses.includes(p.thickness) ? p.thickness : draft.allowed_thicknesses[0], color: allowedColors(draft).includes(p.color) ? p.color : allowedColors(draft)[0] }));
    }, [draft?.allowed_lengths, draft?.allowed_techniques, draft?.allowed_thicknesses, draft?.allowed_colors]);
    const [pendingConfirmation, setPendingConfirmation] = useState<'close' | number | null>(null);
    // Los estilos guardados antes del catálogo de colores se comparan ya completados
    // con «solo negro»: abrirlos no debe marcarlos como modificados.
    const dirty = !!draft && (!record || JSON.stringify(draft) !== JSON.stringify(withColors(record.style)));
    const profile = useMemo(() => draft ? (draft.profile ?? templates[draft.builtin_style ?? 'cateye']) : null, [draft]);
    async function load() {
        setLoading(true);
        setError('');
        try {
            const [styles, options, eyes] = await Promise.all([TryOnService.list(), TryOnOptionsService.all(), TryOnEyeService.list()]);
            setEyeNames(eyes.filter(eye => eye.detection === 'automatic').map(eye => [eye.key, eye.name]));
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
    /** Orden arrastrando en la tabla: se ve al instante y se guarda sin crear versión. */
    async function reorder(keys: string[]) {
        const previous = rows;
        const byKey = new Map(rows.map(r => [r.style.key, r]));
        setRows(keys.flatMap((key, i) => { const r = byKey.get(key); return r ? [{ ...r, style: { ...r.style, sort_order: i } }] : []; }));
        try {
            setRows(await TryOnService.reorder(keys));
            toast.success('Orden actualizado en el probador.');
        }
        catch (e) {
            setRows(previous);
            toast.error(tryOnError(e));
        }
    }
    function availableSelection(style: StyleDraft) {
        const updated = withColors(copy(style));
        for (const [field, kind] of [['allowed_lengths', 'length'], ['allowed_techniques', 'technique'], ['allowed_thicknesses', 'thickness'], ['allowed_colors', 'color']] as const) {
            const choices = activeOptions(kind).map(o => o.id);
            if (kind === 'color' && !choices.length) continue;
            const allowed = (updated[field] ?? []).filter(id => choices.includes(id));
            const next = allowed.length ? allowed : choices.slice(0, 1);
            updated[field] = next;
            if (!next.includes(updated.defaults[kind] ?? -1))
                updated.defaults[kind] = next[0];
        }
        return updated;
    }
    function open(row: StyleRow) { const normalized = availableSelection(row.style); setRecord(row); setDraft(normalized); setPreviewSelection({ ...normalized.defaults, color: normalized.defaults.color ?? 0 }); setOpened(true); setTab('general'); setShowHistory(false); }
    useEffect(() => {
        const key = searchParams.get('style');
        if (loading || error || !key) return;
        const row = rows.find(item => item.style.key === key);
        if (row) open(row);
        const next = new URLSearchParams(searchParams);
        next.delete('style');
        setSearchParams(next, { replace: true });
    }, [loading, error, searchParams]);
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
        setPreviewSelection({ ...style.defaults, color: style.defaults.color ?? 0 });
        setOpened(true);
        setTab('general');
        setShowHistory(false);
    }
    function change(patch: Partial<StyleDraft>) { setDraft(d => d ? { ...d, ...patch } : d); }
    /** Muestra en la vista 3D una técnica con esa distribución base, para que se vea lo que se ajusta. */
    function previewBase(bases: number[]) {
        if (!draft) return;
        const baseOf = (id: number) => (optionGroups.technique.find(r => r.option.id === id)?.published ?? optionGroups.technique.find(r => r.option.id === id)?.option)?.parameters.base_technique ?? id;
        setPreviewSelection(p => {
            if (bases.includes(baseOf(p.technique))) return p;
            const match = draft.allowed_techniques.find(id => baseOf(id) === bases[0]) ?? draft.allowed_techniques.find(id => bases.includes(baseOf(id)));
            return match == null ? p : { ...p, technique: match };
        });
    }
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
    function toggleOption(field: 'allowed_lengths' | 'allowed_techniques' | 'allowed_thicknesses' | 'allowed_colors', value: number) {
        if (!draft)
            return;
        const previous = draft[field] ?? [0];
        const next = previous.includes(value) ? previous.filter(i => i !== value) : [...previous, value].sort((a, b) => a - b);
        if (!next.length)
            return;
        const setting = field === 'allowed_lengths' ? 'length' : field === 'allowed_techniques' ? 'technique' : field === 'allowed_thicknesses' ? 'thickness' : 'color';
        const current = draft.defaults[setting] ?? 0;
        change({ [field]: next, defaults: { ...draft.defaults, [setting]: next.includes(current) ? current : next[0] } });
    }
    const columns: DataTableColumn<TableRow>[] = [
        { key: 'name', header: 'Estilo', sortable: true, getValue: r => r.style.name, render: r => <button className="text-left font-semibold text-[#094732] hover:underline" onClick={() => open(r)}>{r.style.name}</button> },
        { key: 'status', header: 'Estado', getValue: status, render: r => <span className="text-xs">{status(r)}</span> },
        { key: 'order', header: 'Orden', sortable: true, getValue: r => r.style.sort_order, render: r => r.style.sort_order },
        { key: 'default', header: 'Configuración inicial', render: r => <span className="inline-flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: colorHex(r.style.defaults.color ?? 0) }} title={colors[r.style.defaults.color ?? 0]} aria-hidden="true"/>{`${lengths[r.style.defaults.length]} · ${techniques[r.style.defaults.technique]} · ${thicknesses[r.style.defaults.thickness]} · ${colors[r.style.defaults.color ?? 0] ?? 'Negro'}`}</span> },
        { key: 'revision', header: 'Versión publicada', render: r => r.published_revision ?? '—' },
    ];
    return <Layout title="Estilos y efectos" subtitle="Diseña, prueba y publica la colección que verá el salón" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-[#323130]">Estilos y efectos</h1><p className="text-xs text-[#605e5c]">Los cambios se muestran en la app cuando los publicas.</p></div><div className="flex gap-1">{canManage && <Button className="!rounded-sm" variant="secondary" size="sm" leftIcon={<Plus size={14}/>} disabled={loading || !!error} onClick={() => create()}>Nuevo estilo</Button>}<Button className="!rounded-sm" variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} onClick={() => void load()} disabled={loading}>Actualizar</Button></div></div>}>
  <nav className="mb-4 flex flex-wrap gap-4 text-sm text-[#094732]"><Link to="/tryon/lengths">Gestionar largos</Link><Link to="/tryon/techniques">Gestionar técnicas</Link><Link to="/tryon/thicknesses">Gestionar grosores</Link></nav>
  {error && <div role="alert" className="mb-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => void load()}>Reintentar</button></div>}
  <SectionCard variant="business" bodyClassName="p-0"><DataTable data={rows.map(r => ({ ...r, id: r.style.key }))} columns={columns} loading={loading} defaultLimit={50} onReorder={canManage ? ids => void reorder(ids.map(String)) : undefined} reorderHint="Arrastra las filas para cambiar el orden en el probador. Se aplica al instante, sin publicar." globalSearchPlaceholder="Buscar estilo" actions={[{ label: canManage ? 'Editar' : 'Ver', onClick: open }, ...(canManage ? [{ label: 'Duplicar', icon: <Copy size={14}/>, onClick: create }, { label: 'Eliminar borrador', variant: 'danger' as const, onClick: setDeleting, show: (r: TableRow) => !r.published_revision }] : [])]}/></SectionCard>
  <TryOnModal isOpen={opened} onClose={close} maxWidth="max-w-[1280px]" bodyClassName="xl:flex xl:flex-col xl:overflow-hidden xl:py-0" eyebrow="Catálogo del probador · Estilo" title={draft?.name.trim() || (record ? 'Estilo' : 'Nuevo estilo')} status={<><StatusBadge onDark label={record ? status(record) : 'Borrador nuevo'} tone={record ? statusTone(status(record)) : 'draft'}/>{dirty && <StatusBadge onDark label="Sin guardar" tone="pending"/>}</>} footer={<div className="flex w-full flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-[#605e5c]"><span className={`h-2 w-2 rounded-full ${dirty ? 'bg-[#d08b00]' : 'bg-[#1c8a5a]'}`} aria-hidden="true"/>{dirty ? 'Hay cambios sin guardar' : record ? 'Todos los cambios están guardados' : 'Completa el nombre y guarda el borrador'}</p><div className="flex flex-wrap items-center gap-2"><button type="button" className={footerButton.ghost} onClick={close} disabled={busy}>Cerrar</button>{record && <button type="button" className={footerButton.ghost} onClick={() => void history()} disabled={busy}><History size={15}/>Historial</button>}{canManage && <><button type="button" className={footerButton.outline} onClick={() => void save()} disabled={busy || !dirty || !draft?.name.trim()}><Save size={15}/>Guardar borrador</button><button type="button" className={footerButton.primary} onClick={() => void publish()} disabled={busy || dirty || !record || record.published_revision === record.revision}><UploadCloud size={15}/>{busy ? 'Procesando…' : 'Publicar'}</button></>}</div></div>}>
   {draft && profile && <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)]">
    <div className="min-w-0 xl:overflow-y-auto xl:overscroll-contain xl:py-5 xl:pr-2"><EditorTabs label="Secciones del estilo" active={tab} onChange={setTab} tabs={[{ key: 'general', name: 'Información', icon: <Info size={15}/> }, { key: 'shape', name: 'Forma de las pestañas', icon: <Spline size={15}/> }, { key: 'finish', name: 'Acabado y distribución', icon: <Sparkles size={15}/> }, { key: 'options', name: 'Opciones del salón', icon: <SlidersHorizontal size={15}/> }]}/>
    <fieldset disabled={!canManage || busy} className="min-w-0 space-y-5">
     {tab === 'general' && <>
      <EditorSection title="Información del estilo" description="Así se identifica el diseño en el probador y en el catálogo."><div className="space-y-4"><label className={fieldLabel}>Nombre<input className={`${fieldInput} mt-1.5 normal-case tracking-normal`} value={draft.name} maxLength={120} placeholder="Ej. Cat Eye suave" onChange={e => change({ name: e.target.value })}/></label><label className={fieldLabel}>Descripción<textarea className={`${fieldInput} mt-1.5 resize-y normal-case tracking-normal`} value={draft.description} maxLength={1500} rows={3} placeholder="Describe el efecto: dónde se concentra el largo, la curvatura y el tipo de mirada que favorece." onChange={e => change({ description: e.target.value })}/><span className="mt-1 block text-right text-[10px] font-normal normal-case tracking-normal text-[#a19f9d]">{draft.description.length}/1500</span></label><div className="grid items-end gap-4 sm:grid-cols-2"><NumberField label="Orden en el probador" value={draft.sort_order} min={0} max={10000} onChange={v => change({ sort_order: v })}/><BrandSwitch checked={draft.is_active} onChange={v => change({ is_active: v })} label="Disponible al publicar" hint="Si lo desactivas, se publica oculto para la clienta."/></div></div></EditorSection>
      <EditorSection title="Recomendaciones automáticas" icon={<Sparkles size={15}/>} description="El probador analiza la forma de este diseño y lo sugiere según la mirada. Al publicarlo participa automáticamente."><p className="mb-3 text-xs text-[#605e5c]">Miradas que evalúa el probador:</p><div className="flex flex-wrap gap-2">{eyeNames.map(([key, name]) => <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#e3d6bd] bg-[#faf6ee] px-2.5 py-1 text-xs font-medium text-[#7a6338]" key={key}><span className="h-1.5 w-1.5 rounded-full bg-[#9F8351]" aria-hidden="true"/>{name}</span>)}</div></EditorSection>
     </>}
     {tab === 'shape' && <><EditorSection title="Perfil del diseño" description="Cada punto controla el largo, desde el lagrimal hasta la esquina exterior. Puedes partir de otro estilo y darle tu propio acabado."><label className={`${fieldLabel} mb-5 max-w-sm`}>Partir de otro estilo<select className={`${fieldInput} mt-1.5 normal-case tracking-normal`} value="" onChange={e => {
                    if (e.target.value)
                        change({ profile: copy(templates[e.target.value]) });
                }}><option value="">Elegir una base…</option>{baseNames.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}</select></label>{draft.profile === null && <p className="mb-5 border-l-2 border-[#9F8351] bg-[#faf6ee] px-3 py-2 text-xs text-[#7a6338]">Se conserva la forma original aprobada hasta que edites su perfil.</p>}
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{profile.length_profile.map((p, i) => <AdjustmentSlider key={i} ariaLabel={`Largo zona ${i}`} label={i === 0 ? 'Lagrimal' : i === profile.length_profile.length - 1 ? 'Extremo exterior' : `Zona ${Math.round(p.t * 100)}%`} value={p.length} min={.08} max={1.2} step={.005} onChange={v => shape({ length_profile: profile.length_profile.map((point, j) => j === i ? { ...point, length: v } : point) })}/>)}</div>
      {draft.builtin_style && draft.profile && <button type="button" className={`${footerButton.ghost} mt-5 !px-2 text-[#094732]`} onClick={() => change({ profile: null })}><RotateCcw size={14}/>Recuperar forma original</button>}</EditorSection>
      <EditorSection title="Mapeo para la técnica" icon={<Ruler size={15}/>} action={<button type="button" className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" onClick={() => setMapTutorial(true)}><CircleHelp size={14}/>Ver tutorial</button>} description="Largos en mm que el asistente (botón robot) dibuja sobre el parche, del lagrimal al extremo."><LashMapEditor value={draft.lash_map} profile={profile} reference={!draft.profile && draft.builtin_style ? VALIDATED_MAPS[draft.builtin_style] : undefined} onChange={v => change({ lash_map: v })}/>{mapTutorial && <LashMapTutorialDialog userOffset={0} onClose={() => setMapTutorial(false)}/>}</EditorSection></>}
     {tab === 'finish' && <>
      <EditorSection title="Curvatura y abanico" description="Define cómo se curvan las fibras y hacia dónde se abren. Usa el ícono de ayuda para ver una demostración."><div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><NumberField onHelp={() => setHelpTopic('curl')} label="Curvatura" value={profile.curl} min={0} max={1.2} step={.02} onChange={v => shape({ curl: v })}/><NumberField onHelp={() => setHelpTopic('fan')} label="Apertura del abanico" value={profile.fan} min={0} max={35} onChange={v => shape({ fan: v })}/><NumberField onHelp={() => setHelpTopic('sweep')} label="Barrido hacia la sien" value={profile.sweep} min={-40} max={40} onChange={v => shape({ sweep: v })}/><NumberField onHelp={() => setHelpTopic('spike_every')} label="Pico cada N grupos (0: sin picos)" value={profile.spike_every} min={0} max={16} onChange={v => shape({ spike_every: v, spike_offset: v ? Math.min(profile.spike_offset, v - 1) : 0 })}/><NumberField onHelp={() => setHelpTopic('spike_multiplier')} label="Altura relativa del pico" value={profile.spike_multiplier} min={.5} max={2.5} step={.05} onChange={v => shape({ spike_multiplier: v })}/><NumberField onHelp={() => setHelpTopic('width_multiplier')} label="Presencia de las fibras" value={profile.width_multiplier} min={.4} max={1.8} step={.05} onChange={v => shape({ width_multiplier: v })}/><NumberField onHelp={() => setHelpTopic('fan_spread')} label="Apertura en volumen" value={profile.fan_spread} min={0} max={24} onChange={v => { shape({ fan_spread: v }); previewBase([1, 3]); }}/><NumberField onHelp={() => setHelpTopic('mega_fan_spread')} label="Apertura en megavolumen" value={profile.mega_fan_spread} min={0} max={24} onChange={v => { shape({ mega_fan_spread: v }); previewBase([2]); }}/></div></EditorSection>
     </>}
     {tab === 'options' && <EditorSection title="Combinaciones disponibles" description="Elige qué largos, técnicas, grosores y colores podrá probar la clienta con este estilo, y cuál aparece al abrirlo."><div className="divide-y divide-[#edebe9]">{([['allowed_lengths', 'length', 'Largo', lengths], ['allowed_techniques', 'technique', 'Técnica', techniques], ['allowed_thicknesses', 'thickness', 'Grosor', thicknesses]] as const).map(([field, setting, label, options]) => <div key={field} className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_220px]"><div><h4 className="mb-2.5 text-sm font-semibold text-[#323130]">{label}</h4><div className="flex flex-wrap gap-2">{activeOptions(setting).map(({ name, id: i }) => <OptionChip key={i} label={name} checked={draft[field].includes(i)} onChange={() => toggleOption(field, i)}/>)}</div></div><label className={fieldLabel}>Selección inicial<select className={`${fieldInput} mt-1.5 normal-case tracking-normal`} value={draft.defaults[setting]} onChange={e => change({ defaults: { ...draft.defaults, [setting]: Number(e.target.value) } })}>{draft[field].map(i => <option key={i} value={i}>{options[i]}</option>)}</select></label></div>)}
      <div className="grid gap-4 pt-4 md:grid-cols-[minmax(0,1fr)_220px]"><div><h4 className="mb-1 text-sm font-semibold text-[#323130]">Color</h4><p className="mb-2.5 text-xs text-[#605e5c]">Negro conserva el aspecto aprobado. Crea más colores en <Link className="font-medium text-[#094732] underline-offset-2 hover:underline" to="/tryon/colors">Gestionar colores</Link>.</p><div className="flex flex-wrap gap-2">{activeOptions('color').map(({ name, id: i, parameters }) => <ColorChip key={i} label={name} color={parameters.color ?? '#111111'} checked={allowedColors(draft).includes(i)} onChange={() => toggleOption('allowed_colors', i)}/>)}</div></div><label className={fieldLabel}>Selección inicial<select className={`${fieldInput} mt-1.5 normal-case tracking-normal`} value={draft.defaults.color ?? 0} onChange={e => change({ defaults: { ...draft.defaults, color: Number(e.target.value) } })}>{allowedColors(draft).map(i => <option key={i} value={i}>{colors[i] ?? 'Negro'}</option>)}</select></label></div></div></EditorSection>}
    </fieldset>
    {showHistory && <EditorSection className="mt-5" title="Versiones publicadas" icon={<History size={15}/>} description="Recuperar una versión la deja como borrador para que la revises antes de publicar."><div className="divide-y divide-[#edebe9]">{versions.length === 0 ? <p className="text-sm text-[#605e5c]">Todavía no se ha publicado este estilo.</p> : versions.map(v => <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" key={v.revision}><span className="font-semibold text-[#323130]">Versión {v.revision} · <span className="text-xs font-normal text-[#605e5c]">{new Date(v.published_at).toLocaleString()}</span></span>{canManage && <button type="button" className={`${footerButton.ghost} !py-1.5 text-[#094732]`} disabled={busy} onClick={() => void restore(v.revision)}><RotateCcw size={14}/>Recuperar como borrador</button>}</div>)}</div></EditorSection>}
    
    <div className="mt-5"><div className="rounded-sm border border-[#c6ddd1] bg-[#eef6f1] px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]"><UploadCloud size={14}/>Publicación</p><p className="mt-1.5 text-xs leading-relaxed text-[#2f5a48]">Guardar conserva un borrador. Publicar actualiza la colección de la app al volver a abrir el probador. Las versiones publicadas quedan en el historial.</p></div></div>
    </div>
    <aside className="min-w-0 xl:overflow-y-auto xl:overscroll-contain xl:py-5 xl:pr-1"><EditorSection title="Vista previa 3D" icon={<Box size={15}/>} bodyClassName="p-4"><Lash3DPreview profile={profile} selection={previewSelection} options={optionGroups}/><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#edebe9] pt-3">{([['length', 'Largo', lengths, draft.allowed_lengths], ['technique', 'Técnica', techniques, draft.allowed_techniques], ['thickness', 'Grosor', thicknesses, draft.allowed_thicknesses], ['color', 'Color', colors, allowedColors(draft)]] as const).map(([key, label, names, allowed]) => <label className={`${fieldLabel} grid gap-1`} key={key}>{label}<select className={`${fieldInput} !py-1 normal-case tracking-normal`} value={allowed.includes(previewSelection[key]) ? previewSelection[key] : allowed[0]} onChange={e => setPreviewSelection(p => ({ ...p, [key]: Number(e.target.value) }))}>{allowed.map(i => <option key={i} value={i}>{names[i]}</option>)}</select></label>)}</div><p className="mt-2 text-[11px] leading-snug text-[#605e5c]">Párpado de ejemplo; el encaje real se ve en la cámara del probador.</p></EditorSection>
</aside>
   </div>}
  </TryOnModal>
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
