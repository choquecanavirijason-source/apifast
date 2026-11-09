import type { RenderProfile } from '../../../core/services/tryon/tryon.service';

/**
 * Mapeo para la técnica: largo en mm por zona, del lagrimal al extremo.
 * Debe coincidir con `lash_mapping.dart` de la app del probador.
 */
export const MAP_PEAK_MM = 12;
export const MAP_MIN_MM = 7;
export const MAP_DEFAULT_ZONES = 6;
export const MAP_MIN_ZONES = 3;
export const MAP_MAX_ZONES = 12;
export const MAP_VALUE_MIN = 4;
export const MAP_VALUE_MAX = 20;

/** Patrones validados con fotos del salón para estilos base sin mapeo propio (igual que en la app). */
export const VALIDATED_MAPS: Record<string, number[]> = {
    cateye: [9, 10, 11, 12, 13, 14],
    natural: [9, 10, 11, 12, 11, 10],
};

/** Largo del perfil en la posición t (0 = lagrimal, 1 = extremo). */
function lengthAt(points: RenderProfile['length_profile'], t: number) {
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        if (t <= b.t) return a.length + (b.length - a.length) * ((t - a.t) / (b.t - a.t || 1));
    }
    return points[points.length - 1].length;
}

/** Calcula el mapeo desde la forma del estilo, para el largo de referencia. */
export function computeLashMap(profile: RenderProfile, zones = MAP_DEFAULT_ZONES, peakMm = MAP_PEAK_MM) {
    const points = profile.length_profile;
    const min = Math.min(MAP_MIN_MM, peakMm);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const lengths = Array.from({ length: zones }, (_, i) => lengthAt(points, zones === 1 ? 0 : i / (zones - 1)));
    // Se normaliza con la zona más larga (el máximo del perfil puede caer entre zonas).
    const max = Math.max(...lengths);
    const raw = lengths.map(l => clamp(Math.round(peakMm * l / max), min, peakMm));
    // Entre zonas vecinas, a lo sumo 1 mm (como los mapeos reales del salón):
    // se parte del pico y se avanza hacia cada extremo acotando el salto.
    let peak = 0;
    raw.forEach((v, i) => { if (v > raw[peak]) peak = i; });
    const map = [...raw];
    for (let i = peak - 1; i >= 0; i--) map[i] = clamp(clamp(raw[i], map[i + 1] - 1, map[i + 1] + 1), min, peakMm);
    for (let i = peak + 1; i < zones; i++) map[i] = clamp(clamp(raw[i], map[i - 1] - 1, map[i - 1] + 1), min, peakMm);
    return map;
}

/** Desplazamiento en mm de un largo sin valor propio: sale de su escala (0.78 → −2, 1.23 → +2). */
export function defaultMapOffset(scale: number | null | undefined) {
    return Math.round(((scale ?? 1) - 1) * 10);
}
