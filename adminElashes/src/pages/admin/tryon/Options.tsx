import { useEffect, useState } from 'react';
import { Box, CircleHelp, Info, Layers, Pencil, Plus, Trash2, RefreshCw, Route, Save, Sparkles, UploadCloud } from 'lucide-react';
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
import { CurlGlyph, CurlHelpDialog, curlHelpKeys, curlPath, curlPresets } from './CurlPreview';
import type { CurlHelpKey } from './CurlPreview';
import ThicknessPreview, { ThicknessSample } from './ThicknessPreview';
import CurlPreview3D from './CurlPreview3D';
import { baseNames, techniqueChips, techniqueDescription } from './techniqueInfo';
import { loadThumbnailViews, saveThumbnailViews, useOptionThumbnails } from './optionThumbnails';
import type { PreviewCamera } from './Lash3DPreview';
import OptionViewerDialog from './OptionViewerDialog';
import DeleteOptionDialog from './DeleteOptionDialog';
import { TutorialButton, summaryFor } from './OptionIntro';
import LengthPreview, { LengthSample, mmFromScale, scaleFromMm } from './LengthPreview';
import LashMapTutorialDialog from './LashMapTutorialDialog';
import { BrandSwitch, EditorSection, FieldError, StatusBadge, TryOnModal, PestanasNav, ViewToggle, fieldInput, fieldInvalid, fieldLabel, focusFirstInvalid, footerButton, statusTone, useViewMode } from './tryonUi';
const names = { length: 'Largos', technique: 'Técnicas', thickness: 'Grosores', color: 'Colores', curl: 'Curvaturas' };
const singular = { length: 'Largo', technique: 'Técnica', thickness: 'Grosor', color: 'Color', curl: 'Curvatura' };
const curlOf = (p: OptionParameters) => ({ curl_deg: p.curl_deg ?? 50, bend_position: p.bend_position ?? .5, bend_sharpness: p.bend_sharpness ?? .25 });
/** Muestras rápidas para el selector; el salón puede elegir cualquier otro tono. */
const colorPresets = ['#111111', '#2B1B12', '#3B2416', '#6B4226', '#8A5A3B', '#1F2A4A', '#2E4A7A', '#5A1A2B', '#7A2E46', '#1E3A2B', '#4A3B6B', '#6E6E6E'];
const validHex = (v: string | null | undefined) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const defaults: OptionParameters = { scale: null, diameter: null, base_technique: null, fibers_per_group: null, single_every: 0, density: 1, spread: null };
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
/** Distribución base según la estructura de la técnica: 1 fibra = Clásica, 2-4 = Volumen, 5+ = Megavolumen, con fibras sueltas intercaladas = Híbrida. `null` = conservar la actual. */
const autoBase = (p: OptionParameters): number | null => (p.single_every ?? 0) > 0 ? 3 : p.fibers_per_group == null ? null : p.fibers_per_group <= 1 ? 0 : p.fibers_per_group <= 4 ? 1 : 2;
type Row = OptionRow & {
    id: number;
};
const status = (r: OptionRow) => !r.published_revision ? 'Borrador' : r.revision !== r.published_revision ? 'Cambios sin publicar' : r.option.is_active ? 'Publicado' : 'Desactivado';
/** Dibujo representativo de cada opción para la vista de tarjetas. */
function OptionVisual({ kind, p, curlLayout, image }: { kind: OptionKind; p: OptionParameters; curlLayout: { scale: number; rx: number; ry: number }; image?: string }) {
    if (kind === 'curl') {
        // Muestra lateral: un manojo de fibras finas que nacen del mismo punto y con la misma escala en todas las tarjetas.
        const unit = curlPath(curlOf(p), 40), deg = Math.PI / 180, { scale: curlScale, rx, ry } = curlLayout;
        const bundle = [{ f: 1, r: -1.6 }, { f: .95, r: -.6 }, { f: .89, r: .5 }, { f: .83, r: 1.6 }, { f: .77, r: 2.7 }, { f: .71, r: 3.8 }];
        const fiber = ({ f, r }: { f: number; r: number }, i: number) => {
            const c = Math.cos(r * deg), sn = Math.sin(r * deg), line = unit.map(([x, y]) => [rx + curlScale * f * (x * c - y * sn), ry - curlScale * f * (x * sn + y * c)] as const), m = line.length;
            const edge = (sign: number) => line.map(([x, y], j) => {
                const q0 = line[Math.max(0, j - 1)], q1 = line[Math.min(m - 1, j + 1)], dx = q1[0] - q0[0], dy = q1[1] - q0[1], d = Math.hypot(dx, dy) || 1, w = 2.1 * Math.pow(1 - j / (m - 1), 1.1) + .08;
                return `${(x + sign * (-dy / d) * w / 2).toFixed(1)} ${(y + sign * (dx / d) * w / 2).toFixed(1)}`;
            });
            return <path key={i} fill="url(#curlFiber)" opacity={.95 - i * .06} d={`M${[...edge(1), ...edge(-1).reverse()].join('L')}Z`}/>;
        };
        return <svg viewBox="0 0 200 112" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true"><defs>
            <linearGradient id="curlFiber" gradientUnits="userSpaceOnUse" x1={rx} y1="0" x2={rx + 150} y2="0"><stop offset="0" stopColor="#2b211b"/><stop offset=".7" stopColor="#4a3c33"/><stop offset="1" stopColor="#7a6a5e"/></linearGradient>
            <filter id="curlBlur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3"/></filter></defs>
            <ellipse cx={rx + 76} cy={ry + 4} rx="84" ry="3.5" fill="#6b4a32" opacity=".22" filter="url(#curlBlur)"/>
            {bundle.map(fiber)}
            <text x="192" y="106" textAnchor="end" fontSize="13" fontWeight="600" fill="#9F8351">{Math.round(p.curl_deg ?? 0)}°</text></svg>;
    }
    if (kind === 'color') {
        const c = validHex(p.color) ? p.color! : '#111111', gloss = p.gloss ?? 0;
        return <svg viewBox="0 0 200 110" className="h-full w-full" aria-hidden="true"><defs><linearGradient id={`g${c.slice(1)}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={.15 + gloss * .55}/><stop offset=".5" stopColor="#fff" stopOpacity="0"/></linearGradient></defs><rect x="40" y="22" width="120" height="66" rx="10" fill={c} stroke="rgba(0,0,0,.15)"/><rect x="40" y="22" width="120" height="66" rx="10" fill={`url(#g${c.slice(1)})`}/></svg>;
    }
    if (kind === 'thickness') return <ThicknessSample diameter={p.diameter ?? .07}/>;
    if (kind === 'length') return <LengthSample scale={p.scale ?? 1}/>;
    return image ? <img src={image} alt="" className="h-full w-full object-contain"/> : <span className="flex h-full items-center justify-center text-xs text-[#a19f9d]">Generando vista 3D…</span>;
}
export default function TryOnOptionsPage({ kind }: {
    kind: OptionKind;
}) {
    const auth = useAuth(), canManage = auth.isAdmin() || auth.hasPermissionByName('catalog:manage');
    const [rows, setRows] = useState<OptionRow[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<SalonOption | null>(null), [record, setRecord] = useState<OptionRow | null>(null);
    const [optionHelp, setOptionHelp] = useState<OptionHelpKey | null>(null);
    const [mapHelp, setMapHelp] = useState(false);
    const [view, setView] = useViewMode('tryon.options.view');
    const [viewer, setViewer] = useState<OptionRow | null>(null);
    const [thumbViews, setThumbViews] = useState(loadThumbnailViews);
    function setOwnThumbnail(id: number, view: PreviewCamera | null) {
        setThumbViews(prev => {
            const byId = { ...prev.byId };
            if (view) byId[id] = view; else delete byId[id];
            const next = { ...prev, byId };
            saveThumbnailViews(next);
            return next;
        });
    }
    const thumbs = useOptionThumbnails(kind, rows, view === 'cards' && kind === 'technique', thumbViews);
    // Misma escala y mismo punto de origen en todas las curvaturas; el conjunto (la más larga y la más alta) queda centrado en el recuadro.
    const curlLayout = (() => {
        if (kind !== 'curl') return { scale: 100, rx: 20, ry: 94 };
        const ext = rows.map(r => { const pts = curlPath(curlOf(r.option.parameters), 40); return [Math.max(...pts.map(q => q[0]), .01), Math.max(...pts.map(q => q[1]), .01)]; });
        const mx = Math.max(.01, ...ext.map(e => e[0])), my = Math.max(.01, ...ext.map(e => e[1])), scale = Math.min(190, 150 / mx, 74 / my);
        return { scale, rx: (200 - scale * mx) / 2, ry: (112 + scale * my) / 2 - 2 };
    })();
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
    function open(row?: OptionRow) { setShowErrors(false); setBaseManual(false); setOptionHelp(null); setRecord(row ?? null); setDraft(row ? copy(row.option) : { id: 0, name: '', is_active: true, sort_order: rows.length, parameters: { ...defaults, ...(kind === 'length' ? { scale: 1 } : kind === 'thickness' ? { diameter: .07 } : kind === 'color' ? { color: '#3B2416' } : kind === 'curl' ? { curl_deg: 50, bend_position: .5, bend_sharpness: .25 } : { base_technique: 1, fibers_per_group: 3, spread: 10 }) } }); }
    function change(p: Partial<SalonOption>) { setDraft(d => d ? { ...d, ...p } : d); }
    // Las opciones nuevas se activan solas en todos los estilos al publicarse; esto sirve para las que ya existían.
    async function enableEverywhere() {
        if (!record) return;
        setBusy(true);
        try {
            const { styles } = await TryOnOptionsService.enableEverywhere(kind, record.option.id);
            toast.success(styles ? `Activada en ${styles} ${styles === 1 ? 'estilo' : 'estilos'}.` : 'Ya estaba activa en todos los estilos.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    // Borrar opciones creadas por error: solo las que nunca se publicaron (las publicadas se desactivan).
    const [deleting, setDeleting] = useState<OptionRow | null>(null);
    async function removeDraft() {
        if (!deleting) return;
        setBusy(true);
        try {
            await TryOnOptionsService.deleteDraft(kind, deleting.option.id, deleting.revision);
            if (record?.option.id === deleting.option.id) { setDraft(null); setRecord(null); }
            setDeleting(null);
            await load();
            toast.success('Opción eliminada.');
        }
        catch (e) {
            toast.error(tryOnError(e));
        }
        finally {
            setBusy(false);
        }
    }
    // Al guardar o publicar con algo pendiente, se marca lo que falta en vez de dejar el botón apagado.
    const [showErrors, setShowErrors] = useState(false), [pulseSave, setPulseSave] = useState(false);
    const missingName = !draft?.name.trim(), missingColor = kind === 'color' && !validHex(draft?.parameters.color);
    function validate() {
        if (!missingName && !missingColor) return true;
        setShowErrors(true);
        focusFirstInvalid();
        toast.error(`Completa lo que falta: ${[missingName && 'el nombre', missingColor && 'un color válido'].filter(Boolean).join(' y ')}.`);
        return false;
    }
    function trySave() { if (validate()) void save(); }
    function tryPublish() {
        if (!validate()) return;
        if (dirty || !record) {
            setPulseSave(true);
            window.setTimeout(() => setPulseSave(false), 2200);
            toast.warn('Guarda el borrador antes de publicar.');
            return;
        }
        if (record.revision === record.published_revision) { toast.info('No hay cambios por publicar.'); return; }
        void publish();
    }
    // Si alguien fuerza la distribución base a mano, deja de recalcularse sola en esa técnica.
    const [baseManual, setBaseManual] = useState(false);
    function parameters(p: Partial<OptionParameters>) {
        setDraft(d => {
            if (!d) return d;
            const next = { ...d.parameters, ...p };
            if (kind === 'technique' && !baseManual && !('base_technique' in p) && ('fibers_per_group' in p || 'single_every' in p)) {
                const base = autoBase(next);
                if (base !== null) next.base_technique = base;
            }
            return { ...d, parameters: next };
        });
    }
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
    const columns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Nombre', sortable: true, getValue: r => r.option.name, render: r => <button className="font-semibold text-[#094732] hover:underline" onClick={() => open(r)}>{r.option.name}</button> }, { key: 'settings', header: 'Representación', render: r => kind === 'curl' ? <span className="inline-flex items-center gap-2"><CurlGlyph shape={curlOf(r.option.parameters)}/><span className="tabular-nums">{`${r.option.parameters.curl_deg}° · doblez ${Math.round((r.option.parameters.bend_position ?? .5) * 100)}% · nitidez ${Math.round((r.option.parameters.bend_sharpness ?? 0) * 100)}%`}</span></span> : kind === 'color' ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-black/15 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)]" style={{ backgroundColor: r.option.parameters.color ?? '#111111' }} aria-hidden="true"/><span className="font-mono text-xs uppercase">{r.option.parameters.color}</span></span> : kind === 'length' ? `${mmFromScale(r.option.parameters.scale)} mm` : kind === 'thickness' ? `${r.option.parameters.diameter} mm` : r.option.parameters.fibers_per_group === null ? 'Distribución original del estilo' : `${r.option.parameters.fibers_per_group} fibras/grupo · densidad ×${r.option.parameters.density}` }, { key: 'status', header: 'Estado', getValue: status, render: status }, { key: 'order', header: 'Orden', render: r => r.option.sort_order }, { key: 'revision', header: 'Versión publicada', render: r => r.published_revision ?? '—' }];
    const helpButton = (key: OptionHelpKey, label: string) => <button type="button" className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label={`Ayuda: ${label}`} onClick={() => setOptionHelp(key)}><CircleHelp size={15}/></button>;
    const numeric = (label: string, key: keyof OptionParameters, min: number, max: number, step: number, fallback: number) => <AdjustmentSlider label={label} value={(v => typeof v === 'number' ? v : fallback)(draft?.parameters[key])} min={min} max={max} step={step} onChange={value => parameters({ [key]: value })} help={helpButton(key as OptionHelpKey, label)}/>;
    return <Layout title={names[kind]} subtitle="Opciones compartidas con el probador" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{names[kind]} del probador</h1><p className="max-w-3xl text-xs text-[#605e5c]">{summaryFor(kind)}</p></div><div className="flex gap-2"><TutorialButton kind={kind}/>{canManage && <Button variant="secondary" size="sm" leftIcon={<Plus size={14}/>} onClick={() => open()}>Nueva opción</Button>}<Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} disabled={loading} onClick={() => void load()}>Actualizar</Button></div></div>}>
 <PestanasNav active={kind} right={<ViewToggle view={view} onChange={setView}/>}/>
 {error && <div role="alert" className="mb-3 border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
 <SectionCard variant="business" bodyClassName="p-0">{view === 'cards' ? (loading ? <p className="p-6 text-sm text-[#605e5c]">Cargando…</p> : rows.length === 0 ? <p className="p-6 text-sm text-[#605e5c]">Todavía no hay opciones.</p> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] gap-4 p-4">{rows.map(r => <article key={r.option.id} className="flex min-w-0 flex-col overflow-hidden rounded-sm border border-[#e1dfdd] bg-white transition-shadow hover:shadow-md"><button type="button" className={`relative block w-full focus-visible:outline-offset-[-2px] ${kind === 'curl' ? 'aspect-[16/9] bg-gradient-to-br from-[#fdf8f1] to-[#f1e4d5]' : kind === 'technique' ? 'aspect-[3/2] bg-gradient-to-br from-[#fdf8f1] to-[#f1e4d5]' : 'h-36 bg-[#fbf5ee]'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]`} onClick={() => open(r)} aria-label={`${canManage ? 'Editar' : 'Ver'} ${r.option.name}`}><OptionVisual kind={kind} p={r.option.parameters} curlLayout={curlLayout} image={thumbs[r.option.id]}/><span className="absolute left-2 top-2"><StatusBadge label={status(r)} tone={statusTone(status(r))}/></span></button><div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5"><h3 className="truncate text-sm font-semibold text-[#323130]" title={r.option.name}>{r.option.name}</h3><p className="truncate text-xs text-[#605e5c]">{kind === 'curl' ? `${r.option.parameters.curl_deg}° · doblez ${Math.round((r.option.parameters.bend_position ?? .5) * 100)}%` : kind === 'color' ? (r.option.parameters.color ?? '').toUpperCase() : kind === 'length' ? `${mmFromScale(r.option.parameters.scale)} mm` : kind === 'thickness' ? `${r.option.parameters.diameter} mm` : techniqueDescription(r.option.parameters)}</p>{kind === 'technique' && <div className="mt-1 flex flex-wrap gap-1.5">{techniqueChips(r.option.parameters).map(c => <span key={c} className="rounded-sm border border-[#e3d6bd] bg-[#faf6ee] px-2 py-0.5 text-[11px] font-medium text-[#7a6338]">{c}</span>)}</div>}<p className="text-[11px] text-[#8a8886]">Orden {r.option.sort_order} · {r.published_revision ? `versión ${r.published_revision}` : 'sin publicar'}</p><div className="mt-2 flex items-center text-xs font-medium text-[#094732]"><button type="button" className="inline-flex items-center gap-1.5 hover:underline" onClick={() => open(r)}><Pencil size={13}/>{canManage ? 'Editar' : 'Ver'}</button>{kind === 'technique' && <button type="button" className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-[#c9b184] px-3 py-1.5 text-[#7a6338] hover:bg-[#faf6ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" onClick={() => setViewer(r)}><Box size={14}/>Ver en 3D</button>}{canManage && <button type="button" className={`${kind === 'technique' ? 'ml-2' : 'ml-auto'} rounded-sm p-1.5 text-[#8a8886] hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700`} aria-label={`Eliminar ${r.option.name}`} title="Eliminar" onClick={() => setDeleting(r)}><Trash2 size={16}/></button>}</div></div></article>)}</div>) : <DataTable data={rows.map(r => ({ ...r, id: r.option.id }))} columns={columns} loading={loading} defaultLimit={50} onReorder={canManage ? ids => void reorder(ids.map(Number)) : undefined} reorderHint="Arrastra las filas para cambiar el orden en el probador. Se aplica al instante, sin publicar." globalSearchPlaceholder="Buscar opción" actions={[{ label: canManage ? 'Editar' : 'Ver', onClick: open }, ...(canManage ? [{ label: 'Eliminar', variant: 'danger' as const, icon: <Trash2 size={14}/>, onClick: setDeleting }] : [])]}/>}</SectionCard>
 
 {viewer && <OptionViewerDialog kind={kind} name={viewer.option.name} parameters={viewer.option.parameters} onClose={() => setViewer(null)}/>}
 <TryOnModal isOpen={!!draft} onClose={close} bodyClassName="lg:flex lg:flex-col lg:overflow-hidden lg:py-0" eyebrow={`Catálogo del probador · ${singular[kind]}`} title={draft?.name.trim() || (record ? singular[kind] : `Nueva opción de ${singular[kind].toLowerCase()}`)} status={<><StatusBadge onDark label={record ? status(record) : 'Borrador nuevo'} tone={record ? statusTone(status(record)) : 'draft'}/>{dirty && <StatusBadge onDark label="Sin guardar" tone="pending"/>}</>} footer={<div className="flex w-full flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-[#605e5c]"><span className={`h-2 w-2 rounded-full ${dirty ? 'bg-[#d08b00]' : 'bg-[#1c8a5a]'}`} aria-hidden="true"/>{dirty ? 'Hay cambios sin guardar' : record ? 'Todos los cambios están guardados' : 'Completa el nombre y guarda el borrador'}</p><div className="flex flex-wrap items-center gap-2">{canManage && record && record.published_revision !== null && record.option.is_active && <button type="button" className={footerButton.ghost} title={kind === 'curl' ? 'Los estilos que no ofrecen ninguna curvatura conservan su propia curva' : undefined} onClick={() => void enableEverywhere()} disabled={busy}><Layers size={15}/>Activar en todos los estilos</button>}{canManage && record && <button type="button" className={`${footerButton.ghost} !text-red-700`} onClick={() => setDeleting(record)} disabled={busy}><Trash2 size={15}/>Eliminar</button>}<button type="button" className={footerButton.ghost} onClick={close} disabled={busy}>Cerrar</button>{canManage && <><button type="button" className={`${footerButton.outline} ${pulseSave ? 'animate-pulse ring-2 ring-[#9F8351]' : ''}`} disabled={busy || !dirty} onClick={trySave}><Save size={15}/>Guardar borrador</button><button type="button" className={footerButton.primary} disabled={busy} onClick={tryPublish}><UploadCloud size={15}/>{busy ? 'Procesando…' : 'Publicar'}</button></>}</div></div>}>
 {draft && <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]"><div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:py-5 lg:pr-2"><fieldset disabled={!canManage || busy} className="min-w-0 space-y-5"><EditorSection title="Información" icon={<Info size={15}/>} description="Nombre con el que la profesional verá esta opción en el probador."><div className="grid items-end gap-4 sm:grid-cols-2"><label className={fieldLabel}>Nombre<input data-invalid={showErrors && missingName ? 'true' : undefined} aria-invalid={showErrors && missingName} className={`${fieldInput} mt-1.5 ${showErrors && missingName ? fieldInvalid : ''}`} value={draft.name} maxLength={80} placeholder={kind === 'thickness' ? 'Ej. 0.25 mm' : kind === 'length' ? 'Ej. Extra largo' : kind === 'color' ? 'Ej. Café chocolate' : kind === 'curl' ? 'Ej. Ultracurva' : 'Ej. Volumen ruso'} onChange={e => change({ name: e.target.value })}/>{showErrors && missingName && <FieldError>Escribe un nombre para continuar.</FieldError>}</label><label className={fieldLabel}>Orden<input className={`${fieldInput} mt-1.5 tabular-nums`} type="number" min={0} max={10000} step={1} value={draft.sort_order} onChange={e => change({ sort_order: Number(e.target.value) })}/></label><div className="sm:col-span-2"><BrandSwitch checked={draft.is_active} onChange={v => change({ is_active: v })} label="Disponible al publicar" hint="Si lo desactivas, la opción deja de ofrecerse en los estilos."/></div></div></EditorSection>
 <EditorSection title="Cómo se verá en el probador" icon={<Sparkles size={15}/>} description="El largo adapta la forma de cada estilo. Las técnicas regulan la distribución de fibras; el grosor es una representación visual del diámetro nominal."><div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{kind === 'length' && <AdjustmentSlider label="Largo de la pestaña (mm)" value={mmFromScale(draft.parameters.scale)} min={4.8} max={21.6} step={.1} onChange={value => parameters({ scale: scaleFromMm(value) })} help={helpButton('scale', 'Largo de la pestaña')}/>}{kind === 'length' && <div><AdjustmentSlider label="Ajuste del mapeo para la técnica (mm)" value={draft.parameters.map_offset_mm ?? defaultMapOffset(draft.parameters.scale)} min={-10} max={10} step={1} onChange={value => parameters({ map_offset_mm: Math.round(value) })} help={<button type="button" className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label="Ayuda: ajuste del mapeo" title="Ver tutorial" onClick={() => setMapHelp(true)}><CircleHelp size={15}/></button>}/>{mapHelp && <LashMapTutorialDialog userOffset={draft.parameters.map_offset_mm ?? defaultMapOffset(draft.parameters.scale)} onClose={() => setMapHelp(false)}/>}</div>}{kind === 'thickness' && numeric('Diámetro nominal en mm', 'diameter', .03, .25, .005, .07)}{kind === 'color' && <div className="sm:col-span-2" data-invalid={showErrors && missingColor ? 'true' : undefined} tabIndex={-1}><p className={fieldLabel}>Color de la pestaña</p>{showErrors && missingColor && <FieldError>Elige un color válido (formato #RRGGBB).</FieldError>}<div className="mt-2 flex flex-wrap items-center gap-3"><label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-black/15 shadow-[inset_0_1px_3px_rgba(255,255,255,0.25)]" style={{ backgroundColor: validHex(draft.parameters.color) ? draft.parameters.color! : '#111111' }} title="Elegir otro color"><input type="color" aria-label="Selector de color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={validHex(draft.parameters.color) ? draft.parameters.color!.toLowerCase() : '#111111'} onChange={e => parameters({ color: e.target.value.toUpperCase() })}/></label><label className="min-w-0"><span className="sr-only">Código del color</span><input aria-label="Código del color" className={`${fieldInput} w-32 font-mono uppercase`} value={draft.parameters.color ?? ''} maxLength={7} placeholder="#3B2416" onChange={e => { const v = e.target.value.trim(); parameters({ color: (v.startsWith('#') ? v : `#${v}`).toUpperCase() }); }}/></label>{!validHex(draft.parameters.color) && <span className="text-xs text-[#a4262c]">Usa el formato #RRGGBB</span>}</div><div className="mt-4 max-w-md"><AdjustmentSlider label="Brillo del material (0 = mate · 1 = brillante)" value={draft.parameters.gloss ?? 0} min={0} max={1} step={.01} onChange={value => parameters({ gloss: value })}/></div><div className="mt-3 flex flex-wrap gap-2" aria-label="Colores sugeridos">{colorPresets.map(c => <button key={c} type="button" aria-label={`Usar ${c}`} aria-pressed={draft.parameters.color?.toUpperCase() === c} onClick={() => parameters({ color: c })} className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#094732] ${draft.parameters.color?.toUpperCase() === c ? 'border-[#9F8351] ring-2 ring-[#9F8351]/40' : 'border-black/15'}`} style={{ backgroundColor: c }}/>)}</div><p className="mt-3 text-xs text-[#605e5c]">#111111 es el negro aprobado: con ese valor la pestaña se ve exactamente como siempre. Otros colores tiñen la fibra conservando su brillo.</p></div>}{kind === 'curl' && <><div className="sm:col-span-2"><p className={fieldLabel}>Partir de una curvatura conocida</p><div className="mt-2 flex flex-wrap gap-2" aria-label="Curvaturas de referencia">{curlPresets.map(p => <button key={p.name} type="button" onClick={() => parameters(p.shape)} className="inline-flex items-center gap-1.5 rounded-sm border border-[#d2d0ce] bg-white px-2.5 py-1 text-xs font-medium text-[#323130] hover:border-[#094732] hover:text-[#094732] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]"><CurlGlyph shape={p.shape} size={18}/>{p.name}</button>)}</div></div>{numeric('Curvatura total en grados (0 = recta)', 'curl_deg', 0, 150, 1, 50)}{numeric('Dónde se dobla (0 = base · 1 = punta)', 'bend_position', .1, .9, .01, .5)}{numeric('Nitidez del doblez (0 = gradual · 1 = quiebre)', 'bend_sharpness', 0, 1, .01, .25)}<p className="text-xs text-[#605e5c] sm:col-span-2">Curvas suaves (J, C, D) usan nitidez baja; las curvas en L doblan cerca de la base con nitidez alta. Puedes crear curvas nuevas, por ejemplo una ultracurva con más de 100°.</p></>}{kind === 'technique' && <><details className="rounded-sm border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-xs"><summary className="flex cursor-pointer items-center justify-between gap-2 text-[#094732]"><span className="font-medium">Avanzado · distribución base: {baseNames[draft.parameters.base_technique ?? 1]} <span className="font-normal text-[#605e5c]">({baseManual ? 'manual' : 'automática'})</span></span></summary><div className="mt-3"><div className="flex items-center justify-between gap-2"><label htmlFor="tryon-base-technique" className={fieldLabel}>Distribución base</label>{helpButton('base_technique', 'Distribución base')}</div><select id="tryon-base-technique" className={`${fieldInput} mt-1.5`} value={draft.parameters.base_technique ?? 1} onChange={e => { setBaseManual(true); parameters({ base_technique: Number(e.target.value) }); }}>{baseNames.map((n, i) => <option key={i} value={i}>{n}</option>)}</select><p className="mt-2 leading-relaxed text-[#605e5c]">Se ajusta sola según las fibras por grupo: 1 = Clásica, 2 a 4 = Volumen, 5 o más = Megavolumen, y con fibras sueltas intercaladas = Híbrida. Cámbiala solo si necesitas forzarla.</p>{baseManual && <button type="button" className="mt-2 font-medium text-[#094732] hover:underline" onClick={() => { setBaseManual(false); const base = autoBase(draft.parameters); if (base !== null) parameters({ base_technique: base }); }}>Volver a automática</button>}</div></details><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><BrandSwitch checked={draft.parameters.fibers_per_group === null} onChange={keep => parameters(keep ? { fibers_per_group: null, single_every: 0, density: 1, spread: null, layer_split: 0, stem: 0, tip_merge: 0, layer_curl: 0 } : { fibers_per_group: 3, spread: 10 })} label="Conservar distribución original del estilo"/></div>{helpButton('original', 'Conservar distribución original')}</div>{draft.parameters.fibers_per_group !== null && <>{numeric('Fibras por grupo', 'fibers_per_group', 1, 8, 1, 3)}{numeric('Un pelo individual cada N grupos (0 = ninguno)', 'single_every', 0, 8, 1, 0)}{numeric('Densidad relativa de grupos', 'density', .25, 1.5, .05, 1)}{numeric('Apertura del grupo en grados', 'spread', 0, 24, .5, 10)}{numeric('Separación en altura en grados (0 = mismo nivel)', 'layer_split', 0, 40, 1, 0)}{numeric('Tallo: tramo en que las fibras van juntas (0 = abre desde la raíz)', 'stem', 0, .6, .01, 0)}{numeric('Puntas unidas (0 = abanico · 1 = picos, laminado)', 'tip_merge', 0, 1, .01, 0)}{(draft.parameters.layer_split ?? 0) > 0 && numeric('Curva extra del nivel de arriba en grados', 'layer_curl', -40, 40, 1, 0)}</>}</>}</div><p className="mt-5 border-t border-[#edebe9] pt-3 text-xs text-[#605e5c]">El motor limita la cantidad de fibras para mantener la fluidez del probador.</p></EditorSection>
 <div className="rounded-sm border border-[#c6ddd1] bg-[#eef6f1] px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]"><Route size={14}/>Dónde se ofrece</p><p className="mt-1.5 text-xs leading-relaxed text-[#2f5a48]">Después de publicar, entra a Estilos y efectos → edita un estilo → Opciones del salón. Marca esta opción y publica el estilo. Los cambios aparecerán al volver a entrar al probador.</p></div></fieldset></div><aside className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:py-5 lg:pr-1">{kind === 'curl' ? <><CurlPreview3D parameters={draft.parameters}/>{optionHelp && curlHelpKeys.includes(optionHelp as unknown as CurlHelpKey) && <CurlHelpDialog helpKey={optionHelp as unknown as CurlHelpKey} shape={curlOf(draft.parameters)} onClose={() => setOptionHelp(null)} onNavigate={k => setOptionHelp(k as unknown as OptionHelpKey)}/>}</> : <>{kind === 'thickness' && <div className="mb-4"><ThicknessPreview diameter={draft.parameters.diameter ?? .07}/></div>}{kind === 'length' && <div className="mb-4"><LengthPreview scale={draft.parameters.scale ?? 1}/></div>}<Option3DPreview kind={kind} parameters={draft.parameters} helpKey={optionHelp} onHelp={setOptionHelp} hidePanel={kind === 'thickness' || kind === 'length'} thumbnail={kind === 'technique' ? { saved: draft.id in thumbViews.byId, initial: thumbViews.byId[draft.id], canSave: !!record, onSave: v => setOwnThumbnail(draft.id, v), onClear: () => setOwnThumbnail(draft.id, null) } : undefined}/></>}</aside></div>}
 </TryOnModal>
 <ConfirmDialog isOpen={confirmDiscard} title="¿Descartar cambios?" message="Hay cambios sin guardar. Si cierras, se perderán los cambios de este formulario." confirmText="Descartar cambios" cancelText="Seguir editando" variant="danger" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setDraft(null); }}/>
 {deleting && <DeleteOptionDialog name={deleting.option.name} published={deleting.published_revision !== null} busy={busy} onConfirm={() => void removeDraft()} onCancel={() => setDeleting(null)}/>}
 </Layout>;
}
