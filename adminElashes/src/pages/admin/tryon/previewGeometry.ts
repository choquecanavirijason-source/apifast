import type { RenderProfile, OptionGroups } from '@/core/services/tryon/tryon.service';
import { lengthAt, resolvePreviewSettings } from './profilePreview';
export interface PreviewSelection {
    length: number;
    technique: number;
    thickness: number;
}
type Point = [
    number,
    number,
    number
];
const smooth = (n: number) => { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); };
/** Crossed tapered ribbons using the mobile generator's dimensions and curl.
 * The lid is an illustrative contour; real anchoring uses the camera landmarks. */
export function buildPreviewMesh(profile: RenderProfile, selection: PreviewSelection, options: OptionGroups, closed = false) {
    const { p, base, count, scale, diameter } = resolvePreviewSettings(profile, selection.length, selection.technique, selection.thickness, options);
    const vertices: number[] = [], guide: number[] = [];
    const root = (x: number): Point => [x, (closed ? -.10 : .23) * Math.sin(Math.PI * (.5 - x / 3)), -.12 - .18 * (x / 1.5) ** 2];
    function triangle(a: Point, b: Point, c: Point, shade: number) {
        const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
        const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const magnitude = Math.hypot(...normal) || 1;
        for (const point of [a, b, c])
            vertices.push(...point, ...normal.map(n => n / magnitude), shade);
    }
    // Repeatable variation; modifying a slider does not shuffle the fibers.
    let seed = 1101;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    let fibers = 0;
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1), x = (.5 - t) * 3, anchor = root(x);
        const length = lengthAt(profile, t, i) * scale * (.9 + .2 * random());
        const angle = (.5 - t) * profile.fan - profile.sweep * smooth((t - .35) / .65) + (random() - .5) * 6;
        const jitter = (random() - .5) * .064;
        const fan = p?.fibers_per_group != null ? ((p.single_every > 0 && i % p.single_every === 0) ? 1 : p.fibers_per_group) : base === 0 ? 1 : base === 1 ? 3 : base === 2 ? 6 : i % 2 === 0 ? 1 : 3;
        for (let f = 0; f < fan; f++) {
            fibers++;
            const spread = fan === 1 ? 0 : (f / (fan - 1) - .5) * (p?.spread ?? (base === 2 ? profile.mega_fan_spread : profile.fan_spread));
            const len = length * (1 - .06 * Math.abs(spread) / 8), theta = (angle + spread) * Math.PI / 180;
            const width = .028 * diameter / .15 * profile.width_multiplier;
            for (const crossed of [false, true]) {
                const strip: Point[] = [];
                for (let j = 0; j <= 9; j++) {
                    const s = j / 9, cx = x + Math.sin(theta) * len * s ** 1.12 + jitter * len * Math.sin(Math.PI * s);
                    const cy = anchor[1] + (closed ? -1 : 1) * Math.cos(theta) * len * s;
                    const cz = anchor[2] + profile.curl * len * (1.15 * s * s - .15 * s * s * s);
                    const half = width * .5 * ((1 - s) ** 1.2 + .025);
                    for (const side of [-1, 1])
                        strip.push([cx + (crossed ? 0 : side * half), cy, cz + (crossed ? side * half * .65 : 0)]);
                }
                for (let j = 0; j < 9; j++) {
                    const a = j * 2, shade = .045 + .12 * (j / 9) ** .7;
                    triangle(strip[a], strip[a + 1], strip[a + 2], shade);
                    triangle(strip[a + 1], strip[a + 3], strip[a + 2], shade);
                }
            }
        }
    }
    for (let i = 0; i <= 96; i++)
        guide.push(...root(-1.5 + 3 * i / 96));
    if (fibers > 240 || !vertices.every(Number.isFinite))
        throw new Error('Perfil fuera de los límites de la vista previa');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i += 7)
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], vertices[i + k]);
            max[k] = Math.max(max[k], vertices[i + k]);
        }
    const center = min.map((n, k) => (n + max[k]) / 2);
    let radius = 1.5;
    for (let i = 0; i < vertices.length; i += 7)
        radius = Math.max(radius, Math.hypot(vertices[i] - center[0], vertices[i + 1] - center[1], vertices[i + 2] - center[2]));
    return { vertices: new Float32Array(vertices), guide: new Float32Array(guide), fibers, center, radius: radius * 1.12 };
}
