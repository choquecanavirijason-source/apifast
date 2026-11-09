import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
export function lengthAt(profile: RenderProfile, t: number, root: number): number {
    const points = profile.length_profile;
    let i = 0;
    while (i < points.length - 2 && points[i + 1].t < t)
        i++;
    const a = points[i], b = points[i + 1];
    const base = a.length + (b.length - a.length) * (t - a.t) / (b.t - a.t);
    return base * (profile.spike_every > 0 && root % profile.spike_every === profile.spike_offset ? profile.spike_multiplier : 1);
}
export function resolvePreviewSettings(profile: RenderProfile, length: number, technique: number, thickness: number, options?: OptionGroups) {
    const l = options?.length.find(r => r.option.id === length)?.published?.parameters;
    const d = options?.thickness.find(r => r.option.id === thickness)?.published?.parameters;
    const p = options?.technique.find(r => r.option.id === technique)?.published?.parameters;
    const base = p?.base_technique ?? technique;
    const count = p?.fibers_per_group != null || (p?.density ?? 1) !== 1 ? Math.max(8, Math.min(120, Math.floor(240 / (p?.fibers_per_group ?? [1, 3, 6, 3][base])), Math.round(profile.roots[base] * (p?.density ?? 1)))) : profile.roots[base];
    const scale = l?.scale ?? [.78, 1, 1.23][length], diameter = d?.diameter ?? [.05, .07, .10, .15][thickness];
    return { p, base, count, scale, diameter };
}
/** Color del trazo de la miniatura: el negro aprobado o el color inicial del estilo. */
function strokeFor(color: number | undefined, options?: OptionGroups): string {
    if (color == null) return '#171f1b';
    const row = options?.color?.find(r => (r.published ?? r.option).id === color);
    const hex = (row?.published ?? row?.option)?.parameters.color;
    return hex && /^#[0-9a-f]{6}$/i.test(hex) && hex.toUpperCase() !== '#111111' ? hex : '#171f1b';
}
export function profileSvg(profile: RenderProfile, length = 1, technique = 0, thickness = 3, closed = false, options?: OptionGroups, color?: number): string {
    const { p, base, count, scale, diameter } = resolvePreviewSettings(profile, length, technique, thickness, options);
    const lines: string[] = [];
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1), x = 25 + 250 * t, y = closed ? 76 + 10 * Math.sin(Math.PI * t) : 112 - 25 * Math.sin(Math.PI * t);
        const len = lengthAt(profile, t, i) * scale * 65;
        const fan = p?.fibers_per_group != null ? ((p.single_every > 0 && i % p.single_every === 0) ? 1 : p.fibers_per_group) : base === 0 ? 1 : base === 1 ? 3 : base === 2 ? 6 : i % 2 === 0 ? 1 : 3;
        for (let j = 0; j < fan; j++) {
            const spread = fan === 1 ? 0 : (j / (fan - 1) - .5) * (p?.spread ?? (base === 2 ? profile.mega_fan_spread : profile.fan_spread));
            const smooth = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
            const angle = ((.5 - t) * profile.fan - profile.sweep * smooth((t - .35) / .65) + spread) * Math.PI / 180;
            const endX = x - Math.sin(angle) * len, endY = y + (closed ? 1 : -1) * Math.cos(angle) * len;
            lines.push(`<path d="M${x},${y} Q${x + (endX - x) * .25},${y + (endY - y) * .7} ${endX},${endY}"/>`);
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 170"><g fill="none" stroke="${strokeFor(color, options)}" stroke-width="${Math.max(.25, diameter / .15 * 1.35 * profile.width_multiplier)}" stroke-linecap="round">${lines.join('')}</g><path d="M25 ${closed ? 76 : 112} Q150 ${closed ? 96 : 62} 275 ${closed ? 76 : 112}" fill="none" stroke="#094732" stroke-width="1"/></svg>`;
}
export async function thumbnailFromProfile(profile: RenderProfile, defaults: {
    length: number;
    technique: number;
    thickness: number;
    color?: number;
}, options?: OptionGroups): Promise<string> {
    const svg = profileSvg(profile, defaults.length, defaults.technique, defaults.thickness, false, options, defaults.color);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('No se pudo generar la miniatura')); image.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 170;
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error('Vista previa no disponible');
        context.drawImage(image, 0, 0);
        return canvas.toDataURL('image/png');
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
