import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CircleHelp, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import Layout from '@/components/common/layout';
import { Button, SectionCard } from '@/components/common/ui';
import DataTable from '@/components/common/table/DataTable';
import type { DataTableColumn } from '@/components/common/table/DataTable';
import GenericModal from '@/components/common/modal/GenericModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import useAuth from '@/core/hooks/useAuth';
import Option3DPreview from './Option3DPreview';
import AdjustmentSlider from './AdjustmentSlider';
import type { OptionHelpKey } from './optionPreview';
import { TryOnOptionsService, tryOnError } from '@/core/services/tryon/tryon.service';
import type { OptionKind, OptionParameters, OptionRow, SalonOption } from '@/core/services/tryon/tryon.service';
const input = 'w-full rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm';
const names = { length: 'Largos', technique: 'Técnicas', thickness: 'Grosores' };
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
    useEffect(() => { setDraft(null); setRecord(null); void load(); }, [kind]);
    function open(row?: OptionRow) { setOptionHelp(null); setRecord(row ?? null); setDraft(row ? copy(row.option) : { id: 0, name: '', is_active: true, sort_order: rows.length, parameters: { ...defaults, ...(kind === 'length' ? { scale: 1 } : kind === 'thickness' ? { diameter: .07 } : { base_technique: 1, fibers_per_group: 3, spread: 10 }) } }); }
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
    const columns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Nombre', sortable: true, getValue: r => r.option.name, render: r => <button className="font-semibold text-[#094732] hover:underline" onClick={() => open(r)}>{r.option.name}</button> }, { key: 'settings', header: 'Representación', render: r => kind === 'length' ? `Escala ×${r.option.parameters.scale}` : kind === 'thickness' ? `${r.option.parameters.diameter} mm` : r.option.parameters.fibers_per_group === null ? 'Distribución original del estilo' : `${r.option.parameters.fibers_per_group} fibras/grupo · densidad ×${r.option.parameters.density}` }, { key: 'status', header: 'Estado', getValue: status, render: status }, { key: 'order', header: 'Orden', render: r => r.option.sort_order }, { key: 'revision', header: 'Versión publicada', render: r => r.published_revision ?? '—' }];
    const helpButton = (key: OptionHelpKey, label: string) => <button type="button" className="shrink-0 rounded-full p-1 text-[#094732] hover:bg-[#eaf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]" aria-label={`Ayuda: ${label}`} onClick={() => setOptionHelp(key)}><CircleHelp size={15}/></button>;
    const numeric = (label: string, key: keyof OptionParameters, min: number, max: number, step: number, fallback: number) => <AdjustmentSlider label={label} value={draft?.parameters[key] ?? fallback} min={min} max={max} step={step} onChange={value => parameters({ [key]: value })} help={helpButton(key as OptionHelpKey, label)}/>;
    return <Layout title={names[kind]} subtitle="Opciones compartidas con el probador" pageClassName="bg-[#f3f2f1]" toolbar={<div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{names[kind]} del probador</h1><p className="text-xs text-[#605e5c]">Guarda, publica y habilita cada opción en los estilos que correspondan.</p></div><div className="flex gap-2">{canManage && <Button variant="secondary" size="sm" leftIcon={<Plus size={14}/>} onClick={() => open()}>Nueva opción</Button>}<Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14}/>} disabled={loading} onClick={() => void load()}>Actualizar</Button></div></div>}>
 <nav className="mb-4 flex flex-wrap gap-4 text-sm text-[#094732]"><Link to="/designs">Estilos y efectos</Link><Link to="/tryon/lengths">Largos</Link><Link to="/tryon/techniques">Técnicas</Link><Link to="/tryon/thicknesses">Grosores</Link></nav>
 {error && <div role="alert" className="mb-3 border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
 <SectionCard variant="business" bodyClassName="p-0"><DataTable data={rows.map(r => ({ ...r, id: r.option.id }))} columns={columns} loading={loading} globalSearchPlaceholder="Buscar opción" actions={[{ label: canManage ? 'Editar' : 'Ver', onClick: open }]}/></SectionCard>
 <GenericModal isOpen={!!draft} onClose={close} size="lg" contentClassName="!max-w-[1100px] !max-h-[88dvh] !rounded-sm overflow-hidden" bodyClassName="!bg-[#f3f2f1]" closeOnBackdrop={false} title={record ? draft?.name : 'Nueva opción'} footer={<div className="flex w-full flex-wrap justify-between gap-3"><span className="text-xs">{record ? status(record) : 'Borrador nuevo'}{dirty ? ' · Sin guardar' : ''}</span><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={close} disabled={busy}>Cerrar</Button>{canManage && <><Button variant="outline" size="sm" disabled={busy || !dirty || !draft?.name.trim()} onClick={() => void save()}>Guardar borrador</Button><Button variant="secondary" size="sm" disabled={busy || dirty || !record || record.revision === record.published_revision} onClick={() => void publish()}>{busy ? 'Procesando…' : 'Publicar'}</Button></>}</div></div>}>
 {draft && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><fieldset disabled={!canManage || busy} className="min-w-0 space-y-5"><SectionCard variant="business" title="Información"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs">Nombre<input className={`${input} mt-1`} value={draft.name} maxLength={80} onChange={e => change({ name: e.target.value })}/></label><label className="block text-xs">Orden<input className={`${input} mt-1`} type="number" min={0} max={10000} step={1} value={draft.sort_order} onChange={e => change({ sort_order: Number(e.target.value) })}/></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={e => change({ is_active: e.target.checked })}/>Disponible al publicar</label></div></SectionCard>
 <SectionCard variant="business" title="Cómo se verá en el probador"><div className="grid gap-4 sm:grid-cols-2">{kind === 'length' && numeric('Escala respecto al largo del estilo (1 = actual)', 'scale', .4, 1.8, .01, 1)}{kind === 'thickness' && numeric('Diámetro nominal en mm', 'diameter', .03, .25, .005, .07)}{kind === 'technique' && <><div className="text-xs"><div className="flex items-center justify-between gap-2"><label htmlFor="tryon-base-technique">Distribución base</label>{helpButton('base_technique', 'Distribución base')}</div><select id="tryon-base-technique" className={`${input} mt-1`} value={draft.parameters.base_technique ?? 1} onChange={e => parameters({ base_technique: Number(e.target.value) })}>{['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'].map((n, i) => <option key={i} value={i}>{n}</option>)}</select></div><div className="flex items-center gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.parameters.fibers_per_group === null} onChange={e => parameters(e.target.checked ? { fibers_per_group: null, single_every: 0, density: 1, spread: null } : { fibers_per_group: 3, spread: 10 })}/>Conservar distribución original del estilo</label>{helpButton('original', 'Conservar distribución original')}</div>{draft.parameters.fibers_per_group !== null && <>{numeric('Fibras por grupo', 'fibers_per_group', 1, 8, 1, 3)}{numeric('Un pelo individual cada N grupos (0 = ninguno)', 'single_every', 0, 8, 1, 0)}{numeric('Densidad relativa de grupos', 'density', .25, 1.5, .05, 1)}{numeric('Apertura del grupo en grados', 'spread', 0, 24, .5, 10)}</>}</>}</div><p className="mt-4 text-xs text-[#605e5c]">El largo adapta la forma de cada estilo. Las técnicas regulan la distribución de fibras; el motor limita la cantidad para mantener la fluidez. El grosor es una representación visual del diámetro nominal.</p></SectionCard>
 <SectionCard variant="business" title="Dónde se ofrece"><p className="text-sm text-[#605e5c]">Después de publicar, entra a Estilos y efectos → edita un estilo → Opciones del salón. Marca esta opción y publica el estilo. Los cambios aparecerán al volver a entrar al probador.</p></SectionCard></fieldset><aside className="min-w-0 self-start lg:sticky lg:top-0"><Option3DPreview kind={kind} parameters={draft.parameters} helpKey={optionHelp} onHelp={setOptionHelp}/></aside></div>}
 </GenericModal>
 <ConfirmDialog isOpen={confirmDiscard} title="¿Descartar cambios?" message="Hay cambios sin guardar. Si cierras, se perderán los cambios de este formulario." confirmText="Descartar cambios" cancelText="Seguir editando" variant="danger" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setDraft(null); }}/>
 </Layout>;
}
