import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CircleHelp, Info, Plus, RefreshCw, Route, Save, Sparkles, UploadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/common/layout';
import { Button, SectionCard } from '@/components/common/ui';
import DataTable from '@/components/common/table/DataTable';
import type { DataTableColumn } from '@/components/common/table/DataTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import useAuth from '@/core/hooks/useAuth';
import Option3DPreview from './Option3DPreview';
import AdjustmentSlider from './AdjustmentSlider';
import type { OptionHelpKey } from './optionPreview';
import { TryOnOptionsService, tryOnError } from '@/core/services/tryon/tryon.service';
import type { OptionKind, OptionParameters, OptionRow, SalonOption } from '@/core/services/tryon/tryon.service';
import { defaultMapOffset } from './lashMap';
import LashMapTutorialDialog from './LashMapTutorialDialog';
import { BrandSwitch, EditorSection, StatusBadge, TryOnModal, fieldInput, fieldLabel, footerButton, statusTone } from './tryonUi';
const names = { length: 'Largos', technique: 'Técnicas', thickness: 'Grosores', color: 'Colores' };
const singular = { length: 'Largo', technique: 'Técnica', thickness: 'Grosor', color: 'Color' };
/** Muestras rápidas para el selector; el salón puede elegir cualquier otro tono. */
const colorPresets = ['#111111', '#2B1B12', '#3B2416', '#6B4226', '#8A5A3B', '#1F2A4A', '#2E4A7A', '#5A1A2B', '#7A2E46', '#1E3A2B', '#4A3B6B', '#6E6E6E'];
const validHex = (v: string | null | undefined) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const defaults: OptionParameters = { scale: null, diameter: null, base_technique: null, fibers_per_group: null, single_every: 0, density: 1, spread: null };
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
type Row = OptionRow & {
    id: number;
};
const status = (r: OptionRow) => !r.published_revision ? 'Borrador' : r.revision !== r.published_revision ? 'Cambios sin publicar' : r.option.is_active ? 'Publicado' : 'Desactivado';
export default function TryOnOptionsPage({ kind }: {
    kind: OptionKind;
}) {
    const auth = useAuth(), canManage = auth.isAdmin() || auth.hasPermissionByName('catalog:manage');
    const [rows, setRows] = useState<OptionRow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<SalonOption | null>(null), [record, setRecord] = useState<OptionRow | null>(null);
    const [optionHelp, setOptionHelp] = useState<OptionHelpKey | null>(null);
    const [mapHelp, setMapHelp] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const dirty = !!draft && (!record || JSON.stringify(draft) !== JSON.stringify(record.option));
    async function load() {
        setLoading(true);
        setError('');
        try {
            setRows(await TryOnOptionsService.list(kind));
        }
        catch (e) {
            setError(tryOnError(e));
        }
        finally {
            setLoading(false);
        }
    }
    // Vaciar filas al cambiar de catálogo: si la carga falla no deben quedar las de otra categoría.
    useEffect(() => { setDraft(null); setRecord(null); setRows([]); void load(); }, [kind]);
    /** Orden arrastrando en la tabla: se ve al instante y se guarda sin crear versión. */
    async function reorder(ids: number[]) {
        const previous = rows;
        const byId = new Map(rows.map(r => [r.option.id, r]));
        setRows(ids.flatMap((id, i) => { const r = byId.get(id); return r ? [{ ...r, option: { ...r.option, sort_order: i } }] : []; }));
        try {
            setRows(await TryOnOptionsService.reorder(kind, ids));
            toast.success('Orden actualizado en el probador.');
        }
        catch (e) {
            setRows(previous);
            toast.error(tryOnError(e));
        }
    }
    function open(row?: OptionRow) { setOptionHelp(null); setRecord(row ?? null); setDraft(row ? copy(row.option) : { id: 0, name: '', is_active: true, sort_order: rows.length, parameters: { ...defaults, ...(kind === 'length' ? { scale: 1 } : kind === 'thickness' ? { diameter: .07 } : kind === 'color' ? { color: '#3B2416' } : { base_technique: 1, fibers_per_group: 3, spread: 10 }) } }); }
    function change(p: Partial<SalonOption>) { setDraft(d => d ? { ...d, ...p } : d); }
    function parameters(p: Partial<OptionParameters>) { setDraft(d => d ? { ...d, parameters: { ...d.parameters, ...p } } : d); }
    function close() {
        if (busy)
            return;
        if (dirty) {
            setConfirmDiscard(true);
            return;
        }
        setDraft(null);
    }
    async function save() {
        if (!draft)
            return;
        setBusy(true);
        try {
            const r = record ? await TryOnOptionsService.save(kind, draft, record.revision) : await TryOnOptionsService.create(kind, draft);
            setRecord(r);
            setDraft(copy(r.option));
            await load();
            toast.success('Borrador guardado. Publica y asígnalo a los estilos que lo ofrecerán.');
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
            const r = await TryOnOptionsService.publish(kind, record.option.id, record.revision);
            setRecord(r);
            setDraft(copy(r.option));
            await load();
            toast.success('Opción publicada. Las combinaciones se habilitan en cada estilo.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    const columns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Nombre', sortable: true, getValue: r => r.option.name, render: r => <button className="font-semibold text-[#094732] hover:underline" onClick={() => open(r)}>{r.option.name}</button> }, { key: 'settings', header: 'Representación', render: r => kind === 'color' ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-black/15 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)]" style={{ backgroundColor: r.option.parameters.color ?? '#111111' }} aria-hidden="true"/><span className="font-mono text-xs uppercase">{r.option.parameters.color}</span></span> : kind === 'length' ? `Escala ×${r.option.parameters.scale}` : kind === 'thickness' ? `${r.option.parameters.diameter} mm` : r.option.parameters.fibers_per_group === null ? 'Distribución original del estilo' : `${r.option.parameters.fibers_per_group} fibras/grupo · densidad ×${r.option.parameters.density}` }, { key: 'status', header: 'Estado', getValue: status, render: status }, { key: 'order', header: 'Orden', render: r => r.option.sort_order }, { key: 'revision', header: 'Versión publicada', render: r => r.published_revision ?? '—' }];
    const helpButton = (key: OptionHelpKey, label: string) => <button type="button" className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label={`Ayuda: ${label}`} onClick={() => setOptionHelp(key)}><CircleHelp size={15}/></button>;
    const numeric = (label: string, key: keyof OptionParameters, min: number, max: number, step: number, fallback: number) => <AdjustmentSlider label={label} value={(v => typeof v === 'number' ? v : fallback)(draft?.parameters[key])} min={min} max={max} step={step} onChange={value => parameters({ [key]: value })} help={helpButton(key as OptionHelpKey, label)}/>;
    return <Layout title={names[kind]} subtitle="Opciones compartidas con el probador" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{names[kind]} del probador</h1><p className="text-xs text-[#605e5c]">Guarda, publica y habilita cada opción en los estilos que correspondan.</p></div><div className="flex gap-2">{canManage && <Button variant="secondary" size="sm" leftIcon={<Plus size={14}/>} onClick={() => open()}>Nueva opción</Button>}<Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} disabled={loading} onClick={() => void load()}>Actualizar</Button></div></div>}>
 <nav className="mb-4 flex flex-wrap gap-4 text-sm text-[#094732]"><Link to="/designs">Estilos y efectos</Link><Link to="/tryon/lengths">Largos</Link><Link to="/tryon/techniques">Técnicas</Link><Link to="/tryon/thicknesses">Grosores</Link><Link to="/tryon/colors">Colores</Link></nav>
 {error && <div role="alert" className="mb-3 border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
 <SectionCard variant="business" bodyClassName="p-0"><DataTable data={rows.map(r => ({ ...r, id: r.option.id }))} columns={columns} loading={loading} defaultLimit={50} onReorder={canManage ? ids => void reorder(ids.map(Number)) : undefined} reorderHint="Arrastra las filas para cambiar el orden en el probador. Se aplica al instante, sin publicar." globalSearchPlaceholder="Buscar opción" actions={[{ label: canManage ? 'Editar' : 'Ver', onClick: open }]}/></SectionCard>
 <TryOnModal isOpen={!!draft} onClose={close} eyebrow={`Catálogo del probador · ${singular[kind]}`} title={draft?.name.trim() || (record ? singular[kind] : `Nueva opción de ${singular[kind].toLowerCase()}`)} status={<><StatusBadge onDark label={record ? status(record) : 'Borrador nuevo'} tone={record ? statusTone(status(record)) : 'draft'}/>{dirty && <StatusBadge onDark label="Sin guardar" tone="pending"/>}</>} footer={<div className="flex w-full flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-[#605e5c]"><span className={`h-2 w-2 rounded-full ${dirty ? 'bg-[#d08b00]' : 'bg-[#1c8a5a]'}`} aria-hidden="true"/>{dirty ? 'Hay cambios sin guardar' : record ? 'Todos los cambios están guardados' : 'Completa el nombre y guarda el borrador'}</p><div className="flex flex-wrap items-center gap-2"><button type="button" className={footerButton.ghost} onClick={close} disabled={busy}>Cerrar</button>{canManage && <><button type="button" className={footerButton.outline} disabled={busy || !dirty || !draft?.name.trim() || (kind === 'color' && !validHex(draft?.parameters.color))} onClick={() => void save()}><Save size={15}/>Guardar borrador</button><button type="button" className={footerButton.primary} disabled={busy || dirty || !record || record.revision === record.published_revision} onClick={() => void publish()}><UploadCloud size={15}/>{busy ? 'Procesando…' : 'Publicar'}</button></>}</div></div>}>
 {draft && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"><fieldset disabled={!canManage || busy} className="min-w-0 space-y-5"><EditorSection title="Información" icon={<Info size={15}/>} description="Nombre con el que la profesional verá esta opción en el probador."><div className="grid items-end gap-4 sm:grid-cols-2"><label className={fieldLabel}>Nombre<input className={`${fieldInput} mt-1.5`} value={draft.name} maxLength={80} placeholder={kind === 'thickness' ? 'Ej. 0.25 mm' : kind === 'length' ? 'Ej. Extra largo' : kind === 'color' ? 'Ej. Café chocolate' : 'Ej. Volumen ruso'} onChange={e => change({ name: e.target.value })}/></label><label className={fieldLabel}>Orden<input className={`${fieldInput} mt-1.5 tabular-nums`} type="number" min={0} max={10000} step={1} value={draft.sort_order} onChange={e => change({ sort_order: Number(e.target.value) })}/></label><div className="sm:col-span-2"><BrandSwitch checked={draft.is_active} onChange={v => change({ is_active: v })} label="Disponible al publicar" hint="Si lo desactivas, la opción deja de ofrecerse en los estilos."/></div></div></EditorSection>
 <EditorSection title="Cómo se verá en el probador" icon={<Sparkles size={15}/>} description="El largo adapta la forma de cada estilo. Las técnicas regulan la distribución de fibras; el grosor es una representación visual del diámetro nominal."><div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{kind === 'length' && numeric('Escala respecto al largo del estilo (1 = actual)', 'scale', .4, 1.8, .01, 1)}{kind === 'length' && <div><AdjustmentSlider label="Ajuste del mapeo para la técnica (mm)" value={draft.parameters.map_offset_mm ?? defaultMapOffset(draft.parameters.scale)} min={-10} max={10} step={1} onChange={value => parameters({ map_offset_mm: Math.round(value) })} help={<button type="button" className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label="Ayuda: ajuste del mapeo" title="Ver tutorial" onClick={() => setMapHelp(true)}><CircleHelp size={15}/></button>}/>{mapHelp && <LashMapTutorialDialog userOffset={draft.parameters.map_offset_mm ?? defaultMapOffset(draft.parameters.scale)} onClose={() => setMapHelp(false)}/>}</div>}{kind === 'thickness' && numeric('Diámetro nominal en mm', 'diameter', .03, .25, .005, .07)}{kind === 'color' && <div className="sm:col-span-2"><p className={fieldLabel}>Color de la pestaña</p><div className="mt-2 flex flex-wrap items-center gap-3"><label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/15 shadow-[inset_0_1px_3px_rgba(255,255,255,0.25)]" style={{ backgroundColor: validHex(draft.parameters.color) ? draft.parameters.color! : '#111111' }} title="Elegir otro color"><input type="color" aria-label="Selector de color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={validHex(draft.parameters.color) ? draft.parameters.color!.toLowerCase() : '#111111'} onChange={e => parameters({ color: e.target.value.toUpperCase() })}/></label><label className="min-w-0"><span className="sr-only">Código del color</span><input aria-label="Código del color" className={`${fieldInput} w-32 font-mono uppercase`} value={draft.parameters.color ?? ''} maxLength={7} placeholder="#3B2416" onChange={e => { const v = e.target.value.trim(); parameters({ color: (v.startsWith('#') ? v : `#${v}`).toUpperCase() }); }}/></label>{!validHex(draft.parameters.color) && <span className="text-xs text-[#a4262c]">Usa el formato #RRGGBB</span>}</div><div className="mt-3 flex flex-wrap gap-2" aria-label="Colores sugeridos">{colorPresets.map(c => <button key={c} type="button" aria-label={`Usar ${c}`} aria-pressed={draft.parameters.color?.toUpperCase() === c} onClick={() => parameters({ color: c })} className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#094732] ${draft.parameters.color?.toUpperCase() === c ? 'border-[#9F8351] ring-2 ring-[#9F8351]/40' : 'border-black/15'}`} style={{ backgroundColor: c }}/>)}</div><p className="mt-3 text-xs text-[#605e5c]">#111111 es el negro aprobado: con ese valor la pestaña se ve exactamente como siempre. Otros colores tiñen la fibra conservando su brillo.</p></div>}{kind === 'technique' && <><div className="text-xs"><div className="flex items-center justify-between gap-2"><label htmlFor="tryon-base-technique" className={fieldLabel}>Distribución base</label>{helpButton('base_technique', 'Distribución base')}</div><select id="tryon-base-technique" className={`${fieldInput} mt-1.5`} value={draft.parameters.base_technique ?? 1} onChange={e => parameters({ base_technique: Number(e.target.value) })}>{['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><BrandSwitch checked={draft.parameters.fibers_per_group === null} onChange={keep => parameters(keep ? { fibers_per_group: null, single_every: 0, density: 1, spread: null } : { fibers_per_group: 3, spread: 10 })} label="Conservar distribución original del estilo"/></div>{helpButton('original', 'Conservar distribución original')}</div>{draft.parameters.fibers_per_group !== null && <>{numeric('Fibras por grupo', 'fibers_per_group', 1, 8, 1, 3)}{numeric('Un pelo individual cada N grupos (0 = ninguno)', 'single_every', 0, 8, 1, 0)}{numeric('Densidad relativa de grupos', 'density', .25, 1.5, .05, 1)}{numeric('Apertura del grupo en grados', 'spread', 0, 24, .5, 10)}</>}</>}</div><p className="mt-5 border-t border-[#edebe9] pt-3 text-xs text-[#605e5c]">El motor limita la cantidad de fibras para mantener la fluidez del probador.</p></EditorSection>
 <div className="rounded-sm border border-[#c6ddd1] bg-[#eef6f1] px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]"><Route size={14}/>Dónde se ofrece</p><p className="mt-1.5 text-xs leading-relaxed text-[#2f5a48]">Después de publicar, entra a Estilos y efectos → edita un estilo → Opciones del salón. Marca esta opción y publica el estilo. Los cambios aparecerán al volver a entrar al probador.</p></div></fieldset><aside className="min-w-0 self-start lg:sticky lg:top-0"><Option3DPreview kind={kind} parameters={draft.parameters} helpKey={optionHelp} onHelp={setOptionHelp}/></aside></div>}
 </TryOnModal>
 <ConfirmDialog isOpen={confirmDiscard} title="¿Descartar cambios?" message="Hay cambios sin guardar. Si cierras, se perderán los cambios de este formulario." confirmText="Descartar cambios" cancelText="Seguir editando" variant="danger" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setDraft(null); }}/>
 </Layout>;
}
