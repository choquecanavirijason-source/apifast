import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
import { lengthAt, resolvePreviewSettings } from './profilePreview';
import { BASE_PROJECTION_DEG, curlFromStyle, curlUpBack } from './curlShape';
export interface PreviewSelection {
    length: number;
    technique: number;
    thickness: number;
    /** Color de pestaña (id del catálogo). Sin valor = negro aprobado. */
    color?: number;
    /** Curvatura (id del catálogo). Sin valor = la curva propia del estilo. */
    curl?: number | null;
}

/** El negro aprobado: con este valor la pestaña se ve exactamente como siempre. */
export const APPROVED_BLACK = '#111111';

/** Color elegido como RGB 0–1, o `null` para el negro aprobado (sin tinte). */
export function lashTint(selection: PreviewSelection, options: OptionGroups): [number, number, number] | null {
    if (selection.color == null) return null;
    const row = options.color?.find(r => (r.published ?? r.option).id === selection.color);
    const hex = (row?.published ?? row?.option)?.parameters.color;
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex) || hex.toUpperCase() === APPROVED_BLACK) return null;
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}
/** Brillo del material del color elegido (0 mate … 1 brillante). */
export function lashGloss(selection: PreviewSelection, options: OptionGroups): number {
    if (selection.color == null) return 0;
    const row = options.color?.find(r => (r.published ?? r.option).id === selection.color);
    const g = (row?.published ?? row?.option)?.parameters.gloss;
    return typeof g === 'number' && Number.isFinite(g) ? Math.max(0, Math.min(1, g)) : 0;
}
type Point = [
    number,
    number,
    number
];
const smooth = (n: number) => { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); };
/** Floats por vértice: posición (3), normal (3), tono (1) y opacidad (1). */
export const VERTEX_FLOATS = 8;
/** Opacidad a lo largo de la fibra (s = 0 raíz … 1 punta): la punta se vuelve
 * translúcida como un pelo real; el visor la usa con alpha-to-coverage. */
const tipAlpha = (s: number) => s <= .55 ? 1 : 1 - .82 * smooth((s - .55) / .45);
/** Ancho visual a 0.15 mm, igual que la app: 1.3× la proporción real (.00825). */
const FIBER_WIDTH_AT_015 = .0107;
/** Forma de pelo: ancho parejo hasta el 60% y afinado hasta una punta fina (como la app). */
const hairTaper = (s: number) => s <= .6 ? 1 : .04 + .96 * (1 - smooth((s - .6) / .4));
/** Crossed tapered ribbons using the mobile generator's dimensions and curl.
 * The lid is an illustrative contour; real anchoring uses the camera landmarks. */
/**
 * [maxFiberWidth]: ancho máximo (unidades del modelo) de una fibra de 0.15 mm,
 * calculado por el visor para que en pantalla no pase de un pelo (~1.4 px),
 * como en el teléfono. Escala todas las fibras por igual: los grosores
 * conservan su diferencia. Sin valor, el ancho del modelo.
 * [naturalLashes]: dibuja también las pestañas naturales debajo (visor web).
 */
export function buildPreviewMesh(profile: RenderProfile, selection: PreviewSelection, options: OptionGroups, closed = false, maxFiberWidth?: number, naturalLashes = false) {
    const { p, base, count, scale, diameter } = resolvePreviewSettings(profile, selection.length, selection.technique, selection.thickness, options);
    const vertices: number[] = [], guide: number[] = [];
    // Curvatura como en la app: la fibra nace inclinada BASE_PROJECTION_DEG hacia
    // adelante (+Z) y se dobla hacia el párpado según la curva elegida.
    const curlRow = selection.curl == null ? undefined : options.curl?.find(r => (r.published ?? r.option).id === selection.curl);
    const cp = (curlRow?.published ?? curlRow?.option)?.parameters;
    const shape = cp?.curl_deg != null && cp.bend_position != null && cp.bend_sharpness != null
        ? { curl_deg: cp.curl_deg, bend_position: cp.bend_position, bend_sharpness: cp.bend_sharpness }
        : curlFromStyle(profile.curl);
    const SAMPLES = 10;
    const curl = curlUpBack(shape, SAMPLES);
    // Forma del grupo (técnica), como la app: tramo en que las fibras van
    // juntas (tallo), puntas que se vuelven a unir y curva del nivel de arriba.
    const stem = p?.stem ?? 0, tipMerge = p?.tip_merge ?? 0;
    const layerCurl = (p?.layer_split ?? 0) > 0 ? p?.layer_curl ?? 0 : 0;
    const upperCurl = layerCurl === 0 ? curl : curlUpBack({ ...shape, curl_deg: Math.max(0, Math.min(150, shape.curl_deg + layerCurl)) }, SAMPLES);
    const openAt = (s: number) => (stem <= 0 ? 1 : smooth((s - stem) / (stem * .8))) * (1 - tipMerge * smooth((s - .55) / .45));
    const proj = BASE_PROJECTION_DEG * Math.PI / 180, cosP = Math.cos(proj), sinP = Math.sin(proj);
    const root = (x: number): Point => [x, (closed ? -.10 : .23) * Math.sin(Math.PI * (.5 - x / 3)), -.12 - .18 * (x / 1.5) ** 2];
    // Tono y opacidad por vértice (degradado continuo, sin bandas por tramo).
    function triangle(a: Point, b: Point, c: Point, shades: [number, number, number], alphas: [number, number, number]) {
        const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
        const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const magnitude = Math.hypot(...normal) || 1;
        [a, b, c].forEach((point, k) => vertices.push(...point, ...normal.map(n => n / magnitude), shades[k], alphas[k]));
    }
    const widthCap = maxFiberWidth && maxFiberWidth > 0 ? Math.min(1, maxFiberWidth / (FIBER_WIDTH_AT_015 * profile.width_multiplier)) : 1;
    // Repeatable variation; modifying a slider does not shuffle the fibers.
    let seed = 1101;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    let fibers = 0;
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1), x = (.5 - t) * 3, anchor = root(x);
        const length = lengthAt(profile, t, i) * scale * (.9 + .2 * random());
        const angle = (.5 - t) * profile.fan - profile.sweep * smooth((t - .35) / .65) + (random() - .5) * 6;
        const jitter = (random() - .5) * .03;
        const fan = p?.fibers_per_group != null ? ((p.single_every > 0 && i % p.single_every === 0) ? 1 : p.fibers_per_group) : base === 0 ? 1 : base === 1 ? 3 : base === 2 ? 6 : i % 2 === 0 ? 1 : 3;
        for (let f = 0; f < fan; f++) {
            fibers++;
            const spread = fan === 1 ? 0 : (f / (fan - 1) - .5) * (p?.spread ?? (base === 2 ? profile.mega_fan_spread : profile.fan_spread));
            // Lagrimal: arranca corto y fino y crece hacia afuera, como la app.
            const inner = smooth(t / .16);
            const len = length * (1 - .06 * Math.abs(spread) / 8) * (.45 + .55 * inner);
            // Separación en altura (técnica): dos niveles alternados, como la app.
            const split = p?.layer_split ?? 0;
            const lift = (fan > 1 && split > 0 ? (f % 2 === 0 ? split / 2 : -split / 2) : 0) * Math.PI / 180;
            const cosL = Math.cos(lift), sinL = Math.sin(lift);
            const prof = lift > 0 ? upperCurl : curl;
            // Intensidad del relleno: fibras un poco más marcadas, como la app.
            const width = FIBER_WIDTH_AT_015 * diameter / .15 * profile.width_multiplier * (1 + .2 * ((profile.fill ?? 1) - 1)) * (.55 + .45 * inner) * widthCap;
            // Leve variación de tono por fibra, para que se distingan entre sí.
            const tone = .82 + .36 * random();
            for (const crossed of [false, true]) {
                const strip: Point[] = [];
                for (let j = 0; j <= SAMPLES; j++) {
                    const s = j / SAMPLES, theta = (angle + spread * openAt(s)) * Math.PI / 180;
                    const cx = x + Math.sin(theta) * len * 1.18 * s + jitter * len * Math.sin(Math.PI * s);
                    // Fibra en su plano (sube, se dobla hacia atrás) y luego proyectada hacia adelante.
                    // Plano de la fibra (y sube, z hacia adelante), nivel y proyección como la app.
                    const y0 = Math.cos(theta) * len * prof.up[j], z0 = -len * prof.back[j];
                    const y1 = y0 * cosL + z0 * sinL, z1 = -y0 * sinL + z0 * cosL;
                    const cy = anchor[1] + (closed ? -1 : 1) * (y1 * cosP - z1 * sinP);
                    const cz = anchor[2] + y1 * sinP + z1 * cosP;
                    const half = width * .5 * hairTaper(s);
                    for (const side of [-1, 1])
                        strip.push([cx + (crossed ? 0 : side * half), cy, cz + (crossed ? side * half * .65 : 0)]);
                }
                for (let j = 0; j < SAMPLES; j++) {
                    const a = j * 2;
                    const shadeAt = (k: number) => (.045 + .12 * (k / SAMPLES) ** .7) * tone;
                    const s0 = shadeAt(j), s1 = shadeAt(j + 1);
                    const near = tipAlpha(j / SAMPLES), far = tipAlpha((j + 1) / SAMPLES);
                    triangle(strip[a], strip[a + 1], strip[a + 2], [s0, s0, s1], [near, near, far]);
                    triangle(strip[a + 1], strip[a + 3], strip[a + 2], [s0, s1, s1], [near, far, far]);
                }
            }
        }
    }
    // Pestañas NATURALES de la clienta, debajo de las extensiones (solo en la
    // vista web: a la escala de un monitor las extensiones finas dejan huecos
    // que en un ojo real rellenan sus propias pestañas). Más cortas, más finas,
    // un negro más suave y curva leve. Variación propia: no mueve las fibras
    // del estilo. No cuentan en `fibers` (el conteo es de extensiones).
    if (naturalLashes) {
        let nseed = 7919;
        const nrand = () => { nseed = (Math.imul(nseed, 1664525) + 1013904223) >>> 0; return nseed / 4294967296; };
        const natural = curlUpBack({ curl_deg: 28, bend_position: .55, bend_sharpness: .2 }, SAMPLES);
        const NATURAL_COUNT = 110;
        for (let i = 0; i < NATURAL_COUNT; i++) {
            const t = Math.min(1, Math.max(0, (i + (nrand() - .5) * .8) / (NATURAL_COUNT - 1))), x = (.5 - t) * 3, anchor = root(x);
            const len = lengthAt(profile, t, i) * .55 * (.75 + .5 * nrand());
            const theta = ((.5 - t) * profile.fan * .8 + (nrand() - .5) * 14) * Math.PI / 180;
            const width = FIBER_WIDTH_AT_015 * (.07 / .15) * widthCap;
            const tone = .9 + .3 * nrand();
            for (const crossed of [false, true]) {
                const strip: Point[] = [];
                for (let j = 0; j <= SAMPLES; j++) {
                    const s = j / SAMPLES, cx = x + Math.sin(theta) * len * s;
                    const y0 = Math.cos(theta) * len * natural.up[j], z0 = -len * natural.back[j];
                    const cy = anchor[1] + (closed ? -1 : 1) * (y0 * cosP - z0 * sinP);
                    const cz = anchor[2] - .004 + y0 * sinP + z0 * cosP;
                    const half = width * .5 * hairTaper(s);
                    for (const side of [-1, 1])
                        strip.push([cx + (crossed ? 0 : side * half), cy, cz + (crossed ? side * half * .65 : 0)]);
                }
                for (let j = 0; j < SAMPLES; j++) {
                    const a = j * 2;
                    const shadeAt = (k: number) => (.07 + .1 * (k / SAMPLES) ** .7) * tone;
                    const s0 = shadeAt(j), s1 = shadeAt(j + 1);
                    const near = tipAlpha(j / SAMPLES) * .85, far = tipAlpha((j + 1) / SAMPLES) * .85;
                    triangle(strip[a], strip[a + 1], strip[a + 2], [s0, s0, s1], [near, near, far]);
                    triangle(strip[a + 1], strip[a + 3], strip[a + 2], [s0, s1, s1], [near, far, far]);
                }
            }
        }
    }
    for (let i = 0; i <= 96; i++)
        guide.push(...root(-1.5 + 3 * i / 96));
    if (fibers > 360 || !vertices.every(Number.isFinite))
        throw new Error('Perfil fuera de los límites de la vista previa');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i += VERTEX_FLOATS)
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], vertices[i + k]);
            max[k] = Math.max(max[k], vertices[i + k]);
        }
    const center = min.map((n, k) => (n + max[k]) / 2);
    let radius = 1.5;
    for (let i = 0; i < vertices.length; i += VERTEX_FLOATS)
        radius = Math.max(radius, Math.hypot(vertices[i] - center[0], vertices[i + 1] - center[1], vertices[i + 2] - center[2]));
    return { vertices: new Float32Array(vertices), guide: new Float32Array(guide), fibers, center, radius: radius * 1.12, tint: lashTint(selection, options), gloss: lashGloss(selection, options) };
}
