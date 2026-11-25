import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import raw from '@/core/config/tryon-templates.json';
import type { OptionKind, OptionParameters, RenderProfile } from '@/core/services/tryon/tryon.service';
import Lash3DPreview from './Lash3DPreview';
import { optionPreviewDemo } from './optionPreview';

const profile = (raw.templates as Record<string, RenderProfile>).cateye;

/** Visor 3D interactivo de una opción del catálogo, con el mismo estilo de prueba que las miniaturas. */
export default function OptionViewerDialog({ kind, name, parameters, onClose }: { kind: OptionKind; name: string; parameters: OptionParameters; onClose: () => void }) {
    const demo = useMemo(() => optionPreviewDemo(profile, kind, parameters, 'Cat Eye'), [kind, parameters]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label={`${name} en 3D`} onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-[#9F8351] bg-[#094732] px-5 py-3 text-white"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">Vista 3D · Estilo de prueba Cat Eye</p><h2 className="mt-0.5 text-lg font-semibold leading-tight">{name}</h2></div><button type="button" className="rounded-sm p-1.5 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8c7a4]" aria-label="Cerrar" onClick={onClose}><X size={18}/></button></header>
            <div className="min-h-0 overflow-y-auto p-4"><Lash3DPreview profile={demo.profile} selection={demo.selection} options={demo.options} canExpand={false}/></div>
        </div>
    </div>, document.body);
}
