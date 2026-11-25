import { useMemo } from 'react';
import raw from '@/core/config/tryon-templates.json';
import type { OptionGroups, OptionParameters, RenderProfile } from '@/core/services/tryon/tryon.service';
import Lash3DPreview from './Lash3DPreview';
import { optionDefaults } from './optionPreview';
import { SAMPLE_GROUPS } from './optionThumbnails';

const profile = (raw.templates as Record<string, RenderProfile>).cateye;

/**
 * Vista 3D de una curvatura: unas pocas fibras iguales, con la curva que se está
 * editando, que se pueden girar y acercar. Usa el mismo motor que el probador.
 */
export default function CurlPreview3D({ parameters }: { parameters: OptionParameters }) {
    const demo = useMemo(() => {
        const option = { id: 4094, name: 'Vista de prueba', is_active: true, sort_order: 0, parameters: { ...optionDefaults, curl_deg: parameters.curl_deg ?? 50, bend_position: parameters.bend_position ?? .5, bend_sharpness: parameters.bend_sharpness ?? .25 } };
        const options: OptionGroups = { length: [], technique: [], thickness: [], color: [], curl: [{ option, published: { ...option, revision: 1 }, revision: 1, published_revision: 1 }] };
        return { options, selection: { length: 1, technique: 0, thickness: 3, curl: 4094 } };
    }, [parameters.curl_deg, parameters.bend_position, parameters.bend_sharpness]);
    return <div className="rounded-sm border border-[#edebe9] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]">Vista 3D de la curvatura</p>
        <Lash3DPreview profile={profile} selection={demo.selection} options={demo.options} sample={SAMPLE_GROUPS} initialView="profile"/>
        <p className="mt-2 text-[11px] leading-snug text-[#605e5c]">Las fibras son iguales y salen del mismo punto: solo cambia la curva. Gira y acerca el modelo para verla desde cualquier ángulo.</p>
    </div>;
}
