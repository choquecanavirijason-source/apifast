import type { OptionParameters } from '@/core/services/tryon/tryon.service';

/** Estructura de una técnica deducida de sus parámetros guardados (no del nombre). */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const baseNames = ['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'];
type Shape = { n: number; hybrid: boolean; stem: number; fanN: number; curl: number; tipMerge: number };

function techniqueShape(p: OptionParameters): Shape {
    const base = p.base_technique ?? 1, original = p.fibers_per_group == null;
    const n = original ? [1, 3, 6, 3][base] : Math.max(1, p.fibers_per_group!);
    const hybrid = (p.single_every ?? 0) > 0 || (original && base === 3);
    const fanN = hybrid ? (original || n < 2 ? 4 : n) : n;
    const split = p.layer_split ?? 0, stemRaw = p.stem ?? 0, count = hybrid ? fanN : n;
    const stem = count >= 2 ? (stemRaw > 0 ? clamp(stemRaw, .2, .6) : count === 2 && split > 0 ? .35 : 0) : 0;
    return { n, hybrid, stem, fanN, curl: p.layer_curl ?? 0, tipMerge: clamp(p.tip_merge ?? 0, 0, 1) };
}

/** Explicación corta de lo que hace la técnica. */
export function techniqueDescription(p: OptionParameters): string {
    const s = techniqueShape(p), original = p.fibers_per_group == null, base = p.base_technique ?? 1;
    let text: string;
    if (s.hybrid) text = original ? 'Alterna extensiones clásicas con abanicos de volumen.' : `Alterna fibras sueltas con abanicos de ${s.fanN}.`;
    else if (s.n === 1) text = 'Una extensión por pestaña natural.';
    else if (s.n === 2 && s.stem > 0) text = s.curl !== 0 ? 'Dos ramas en Y con curvaturas distintas.' : 'Dos fibras unidas en un tallo con forma de Y.';
    else if (s.n === 2) text = 'Dos fibras separadas desde el punto de adhesión.';
    else if (s.stem > 0) text = `${s.n} fibras que nacen juntas en un tallo y luego se abren.`;
    else if (s.n === 3) text = 'Tres fibras por punto de adhesión.';
    else if (original && base === 1) text = 'Abanico ligero y simétrico de varias fibras.';
    else if (original && base === 2) text = 'Abanico más denso con múltiples fibras muy finas.';
    else text = s.n >= 6 ? `Abanico denso de ${s.n} fibras muy finas.` : `${s.n} fibras abiertas en abanico.`;
    return s.tipMerge > .3 && !s.hybrid ? `${text} Las puntas se unen en picos.` : text;
}

/** Parámetros que más distinguen a la técnica, listos para mostrarse como chips. */
export function techniqueChips(p: OptionParameters): string[] {
    const base = p.base_technique ?? 1, fibers = p.fibers_per_group ?? [1, 3, 6, 3][base];
    const chips = [`${fibers} ${fibers === 1 ? 'fibra' : 'fibras'}/grupo`, `Apertura ${Number((p.spread ?? 10).toFixed(1))}°`, `Densidad ×${Number((p.density ?? 1).toFixed(2))}`];
    if ((p.single_every ?? 0) > 0) chips.push(`Fibra suelta cada ${p.single_every}`);
    if ((p.layer_split ?? 0) > 0) chips.push(`Altura ${p.layer_split}°`);
    if ((p.stem ?? 0) > 0) chips.push(`Tallo ${Math.round(p.stem! * 100)}%`);
    if ((p.tip_merge ?? 0) > 0) chips.push(`Puntas unidas ${Math.round(p.tip_merge! * 100)}%`);
    if ((p.layer_split ?? 0) > 0 && (p.layer_curl ?? 0) !== 0) chips.push(`Curva extra ${p.layer_curl}°`);
    return chips;
}
