import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import type { OptionKind } from '@/core/services/tryon/tryon.service';
import { curlPath } from './curlShape';
import type { CurlShape } from './curlShape';

/**
 * Tutorial animado (tipo video) de cada apartado del catálogo de pestañas:
 * qué es, qué variantes tiene y cómo se usa. Cada escena se dibuja en función
 * del tiempo, con capítulos, pausa y barra de avance. No modifica nada.
 */
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const x = clamp01(n); return x * x * (3 - 2 * x); };
/** Avance suave (0 → 1) entre dos instantes. */
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const RAD = Math.PI / 180, STEPS = 26, BASE = 252;
type Pt = readonly [number, number];

/** Fibra desde (x, y): dirección `theta` desde la vertical y curva `bend` que crece hacia la punta; dibuja hasta `upto`. */
function trace(x: number, y: number, len: number, theta: number, bend: number, upto = 1): Pt[] {
    const pts: Pt[] = [[x, y]], n = Math.max(2, Math.round(STEPS * clamp01(upto))), ds = len / STEPS;
    for (let k = 1; k <= n; k++) {
        const dir = (theta + bend * Math.pow((k - .5) / STEPS, 1.5)) * RAD;
        x += Math.sin(dir) * ds;
        y -= Math.cos(dir) * ds;
        pts.push([x, y]);
    }
    return pts;
}
/** Pestaña con raíz gruesa y punta muy fina. */
function taper(points: Pt[], w0: number, w1 = .15, total = STEPS) {
    const m = points.length, edge = (sign: number) => points.map(([x, y], j) => {
        const a = points[Math.max(0, j - 1)], b = points[Math.min(m - 1, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = w1 + (w0 - w1) * Math.pow(1 - j / total, .9);
        return `${(x + sign * (-dy / d) * w / 2).toFixed(1)} ${(y + sign * (dx / d) * w / 2).toFixed(1)}`;
    });
    return `M${[...edge(1), ...edge(-1).reverse()].join('L')}Z`;
}
function fiber(key: string, x: number, y: number, len: number, theta: number, bend: number, w0: number, progress: number, fill = 'url(#tutInk)', opacity = 1) {
    if (progress <= .001) return null;
    return <path key={key} d={taper(trace(x, y, len, theta, bend, progress), w0)} fill={fill} opacity={opacity}/>;
}
type Structure = 'clasica' | '2d' | 'y' | '3d' | 'volumen';
/** Un punto de aplicación con la estructura de una técnica. */
function group(kind: Structure, x: number, y: number, prog: number, key: string, len = 120, opacity = 1): ReactNode[] {
    const out: ReactNode[] = [], add = (n: ReactNode) => { if (n) out.push(n); }, fill = 'url(#tutInk)';
    if (kind === 'clasica') add(fiber(`${key}a`, x, y, len, 4, 14, 5, prog, fill, opacity));
    else if (kind === '2d') { add(fiber(`${key}a`, x, y, len, -16, -10, 4.4, prog, fill, opacity)); add(fiber(`${key}b`, x, y, len, 16, 10, 4.4, prog, fill, opacity)); }
    else if (kind === '3d') [[-22, -10], [0, 4], [22, 10]].forEach(([th, bd], i) => add(fiber(`${key}${i}`, x, y, len, th, bd, 3.8, prog, fill, opacity)));
    else if (kind === 'volumen') [-28, -14, 0, 14, 28].forEach((th, i) => add(fiber(`${key}${i}`, x, y, len * (1 - .06 * Math.abs(th) / 28), th, Math.sign(th) * 9, 2.6, prog, fill, opacity)));
    else {
        const stem = len * .38, top = trace(x, y, stem, 2, 4).slice(-1)[0], rest = len - (y - top[1]);
        add(fiber(`${key}s`, x, y, stem, 2, 4, 6, seg(prog, 0, .45), fill, opacity));
        add(fiber(`${key}l`, top[0], top[1], rest, -17, -9, 4.2, seg(prog, .4, 1), fill, opacity));
        add(fiber(`${key}r`, top[0], top[1], rest, 17, 9, 4.2, seg(prog, .4, 1), fill, opacity));
    }
    return out;
}

// ---------- piezas de las escenas ----------
function Label({ x, y, children, size = 16, color = '#094732', weight = 600, anchor = 'middle', opacity = 1 }: { x: number; y: number; children: ReactNode; size?: number; color?: string; weight?: number; anchor?: 'start' | 'middle' | 'end'; opacity?: number }) {
    return <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={color} opacity={opacity}>{children}</text>;
}
const Ground = () => <><ellipse cx="300" cy={BASE + 5} rx="250" ry="4" fill="#6b4a32" opacity=".13"/><line x1="50" y1={BASE} x2="550" y2={BASE} stroke="#cdb7a0" strokeWidth="1.4"/></>;
/** Fila de opciones; la activa se resalta. */
function Chips({ items, active, y, opacity = 1 }: { items: string[]; active: number; y: number; opacity?: number }) {
    const widths = items.map(s => s.length * 7.4 + 26), total = widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 8;
    let x = 300 - total / 2;
    return <g opacity={opacity}>{items.map((s, i) => { const w = widths[i], cx = x; x += w + 8; return <g key={s}><rect x={cx} y={y} width={w} height="28" rx="3" fill={i === active ? '#094732' : '#fff'} stroke={i === active ? '#094732' : '#d6dfd9'}/><text x={cx + w / 2} y={y + 18.5} textAnchor="middle" fontSize="13" fontWeight="600" fill={i === active ? '#fff' : '#094732'}>{s}</text></g>; })}</g>;
}
/** Tarjetas de pasos que van apareciendo. */
function StepCards({ t, start, items }: { t: number; start: number; items: { title: string; line1: string; line2: string }[] }) {
    const w = 118, gap = 12, total = items.length * w + (items.length - 1) * gap, x0 = 300 - total / 2;
    return <g>{items.map((it, i) => {
        const a = seg(t, start + i * 1.4, start + i * 1.4 + .6), check = seg(t, start + i * 1.4 + .8, start + i * 1.4 + 1.2), x = x0 + i * (w + gap);
        return <g key={it.title} opacity={a} transform={`translate(0 ${(1 - a) * 14})`}>
            <rect x={x} y="100" width={w} height="124" rx="6" fill="#fff" stroke="#d6dfd9"/>
            <circle cx={x + 22} cy="128" r="12" fill="#094732"/><text x={x + 22} y="133" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{i + 1}</text>
            <text x={x + 14} y="164" fontSize="16" fontWeight="700" fill="#094732">{it.title}</text>
            <text x={x + 14} y="184" fontSize="11.5" fill="#605e5c">{it.line1}</text><text x={x + 14} y="199" fontSize="11.5" fill="#605e5c">{it.line2}</text>
            <path d={`M${x + w - 30} 124 l6 6 l11 -13`} fill="none" stroke="#1c8a5a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={30 * (1 - check)}/>
        </g>;
    })}</g>;
}

// ---------- escenas ----------
const XS = [170, 300, 430];

function techniqueScene(t: number) {
    if (t < 7) {
        const g = seg(t, 1.2, 4.2);
        return <>{XS.map(x => <g key={x}><circle cx={x} cy={BASE} r={4.5 + 1.2 * Math.sin(t * 4)} fill="#9F8351" opacity={1 - g * .55}/>{group('clasica', x, BASE, g, `a${x}`)}</g>)}
            <Label x={300} y={52} opacity={seg(t, .3, 1)}>Cada extensión se pega en un punto del párpado</Label>
            <Label x={300} y={78} size={13} color="#7a6338" weight={500} opacity={seg(t, 1.5, 2.5)}>Es el punto de aplicación</Label></>;
    }
    if (t < 14) {
        const kinds: [Structure, string][] = [['clasica', 'Clásica · 1 fibra'], ['2d', '2D · 2 fibras separadas'], ['y', 'Y · un tallo y dos ramas'], ['3d', '3D · 3 fibras'], ['volumen', 'Volumen · abanico de fibras finas']];
        const per = 1.4, i = Math.min(kinds.length - 1, Math.floor((t - 7) / per)), local = t - 7 - i * per;
        return <>{XS.map(x => <g key={x}>{group(kinds[i][0], x, BASE, seg(local, 0, .7), `b${x}`)}</g>)}
            <Label x={300} y={58} size={20} opacity={seg(local, 0, .3)}>{kinds[i][1]}</Label></>;
    }
    if (t < 21) {
        const hs = (x: number) => 55 + 95 * Math.pow((x - 90) / 420, 1.5);
        const silhouette = Array.from({ length: 22 }, (_, k) => 90 + 420 * k / 21).map(x => [x, BASE - hs(x)] as Pt);
        const draw = seg(t, 14.3, 16.3), shown = silhouette.slice(0, Math.max(2, Math.round(silhouette.length * draw)));
        const phase2 = t >= 16.5, phase3 = t >= 18.5, fade = phase2 ? .35 : 1;
        return <>
            <path d={`M${shown.map(p => p.join(' ')).join('L')}`} fill="none" stroke="#9F8351" strokeWidth="2.4" strokeDasharray="7 6" opacity={fade}/>
            {phase2 && !phase3 && group('volumen', 300, BASE, seg(t, 16.5, 17.8), 'c', 120)}
            {phase3 && Array.from({ length: 9 }, (_, i) => { const x = 100 + i * 50; return <g key={i}>{group('volumen', x, BASE, seg(t, 18.5 + i * .22, 19.4 + i * .22), `d${i}`, hs(x) * .85)}</g>; })}
            <Label x={300} y={50} size={19} opacity={seg(t, 14.3, 15)}>{phase3 ? 'Juntos: lo que ve la clienta' : phase2 ? 'TÉCNICA: cómo se arma cada grupo' : 'ESTILO: dónde va el largo'}</Label></>;
    }
    return <StepCards t={t} start={21.4} items={[{ title: 'Crea', line1: 'fibras, apertura,', line2: 'tallo, puntas…' }, { title: 'Revisa', line1: 'en 3D, con unos', line2: 'pocos grupos' }, { title: 'Publica', line1: 'se guarda la', line2: 'versión nueva' }, { title: 'Activa', line1: 'en cada estilo', line2: 'que la ofrezca' }]}/>;
}

const MM = 8;
/** Tres fibras de `mm` milímetros con regla; `marker` muestra la medida. */
function lengthFibers(mm: number, progress: number, marker: boolean, key: string) {
    const rx = 470, top = BASE - 16 * MM, mark = BASE - mm * MM;
    return <>{[150, 230, 310].map(x => fiber(`${key}${x}`, x, BASE, mm * MM, 4, 14, 4.4, progress))}
        <line x1={rx} y1={top} x2={rx} y2={BASE} stroke="#b9ab9e" strokeWidth="1"/>
        {Array.from({ length: 17 }, (_, i) => <line key={i} x1={rx} y1={BASE - i * MM} x2={rx + (i % 5 === 0 ? 8 : 5)} y2={BASE - i * MM} stroke="#b9ab9e" strokeWidth="1"/>)}
        {marker && <><line x1={rx - 6} y1={mark} x2={rx + 12} y2={mark} stroke="#9F8351" strokeWidth="2.4" strokeLinecap="round"/><Label x={rx + 18} y={mark + 5} anchor="start" size={15} color="#6f5a33">{`${Number(mm.toFixed(1))} mm`}</Label></>}</>;
}
function lengthScene(t: number) {
    if (t < 7) return <>{lengthFibers(12, seg(t, 1, 4), t > 4.2, 'a')}<Label x={300} y={52} opacity={seg(t, .3, 1)}>El largo es cuánto miden las pestañas</Label></>;
    if (t < 14) {
        const names = ['Corto', 'Medio', 'Largo'], mms = [9.4, 12, 14.8], per = 2.3, i = Math.min(2, Math.floor((t - 7) / per)), local = t - 7 - i * per;
        const mm = lerp(i === 0 ? 12 : mms[i - 1], mms[i], seg(local, 0, .7));
        return <>{lengthFibers(mm, 1, true, 'b')}<Label x={300} y={52} size={20}>{`${names[i]} · ${mm.toFixed(1)} mm`}</Label></>;
    }
    const labels = ['Corto', 'Medio', 'Largo', '10 mm', '13 mm'], mms = [9.4, 12, 14.8, 10, 13], per = 1.4, i = Math.min(4, Math.floor((t - 14) / per)), local = t - 14 - i * per;
    const mm = lerp(i === 0 ? 12 : mms[i - 1], mms[i], seg(local, 0, .6));
    return <>{lengthFibers(mm, 1, true, 'c')}<Chips items={labels} active={i} y={34}/><Label x={300} y={86} size={14} color="#605e5c" weight={500}>La clienta elige entre los largos que dejes disponibles</Label></>;
}

/** Tres fibras del grosor `d` (mm) y un círculo con el corte ampliado. */
function thicknessFibers(d: number, progress: number, zoom: number, key: string) {
    const w = 1.6 + d * 42, ring = 150 + 0 * zoom;
    return <>{[130, 200, 270].map(x => fiber(`${key}${x}`, x, BASE, 120, 4, 14, w, progress))}
        {zoom > 0 && <g opacity={zoom}><line x1="300" y1="190" x2="400" y2="170" stroke="#c8b6a4" strokeWidth="1.2"/><circle cx="450" cy={ring + 20} r="50" fill="#fff" fillOpacity=".7" stroke="#cdb9a6" strokeWidth="1.4"/><circle cx="450" cy={ring + 20} r={Math.max(2, d * 90)} fill="#1b1b1b"/><Label x={450} y={ring + 98} size={15} color="#6f5a33">{`${Number(d.toFixed(2))} mm`}</Label></g>}</>;
}
function thicknessScene(t: number) {
    if (t < 7) return <>{thicknessFibers(.07, seg(t, 1, 3.5), seg(t, 3.5, 5), 'a')}<Label x={300} y={52} opacity={seg(t, .3, 1)}>El grosor es el diámetro de cada fibra</Label></>;
    if (t < 14) {
        const ds = [.05, .07, .15, .25], per = 1.75, i = Math.min(3, Math.floor((t - 7) / per)), local = t - 7 - i * per, d = lerp(i === 0 ? .07 : ds[i - 1], ds[i], seg(local, 0, .6));
        return <>{thicknessFibers(d, 1, 1, 'b')}<Label x={300} y={52} size={20}>{i < 2 ? 'Más fino: se ve natural' : 'Más grueso: se ve más marcado'}</Label></>;
    }
    const labels = ['0.05 mm', '0.07 mm', '0.15 mm'], ds = [.05, .07, .15], per = 2, i = Math.min(2, Math.floor((t - 14) / per)), local = t - 14 - i * per, d = lerp(i === 0 ? .15 : ds[i - 1], ds[i], seg(local, 0, .6));
    return <>{thicknessFibers(d, 1, 1, 'c')}<Chips items={labels} active={i} y={34}/><Label x={300} y={86} size={14} color="#605e5c" weight={500}>Se combina con el estilo, la técnica y el largo</Label></>;
}

const COLORS: [string, string][] = [['Negro', '#111111'], ['Café oscuro', '#3B2416'], ['Café', '#6B4226'], ['Azul noche', '#1F2A4A'], ['Borgoña', '#5A1A2B']];
function colorFibers(color: string, progress: number, key: string) {
    return <>{[150, 220, 290, 360].map(x => fiber(`${key}${x}`, x, BASE, 125, 4, 14, 4.6, progress, color))}</>;
}
function colorScene(t: number) {
    if (t < 7) return <>{colorFibers('#111111', seg(t, 1, 4), 'a')}<Label x={300} y={52} opacity={seg(t, .3, 1)}>El color es el tono de las pestañas</Label><Label x={300} y={78} size={13} color="#7a6338" weight={500} opacity={seg(t, 4, 5)}>El negro es el aspecto aprobado de todos los estilos</Label></>;
    if (t < 14) {
        const per = 1.4, i = Math.min(4, Math.floor((t - 7) / per));
        return <>{colorFibers(COLORS[i][1], 1, 'b')}<Label x={300} y={52} size={20}>{COLORS[i][0]}</Label>
            <g>{COLORS.map(([n, c], k) => <circle key={n} cx={190 + k * 55} cy="292" r={k === i ? 17 : 12} fill={c} stroke={k === i ? '#9F8351' : 'rgba(0,0,0,.15)'} strokeWidth={k === i ? 3 : 1}/>)}</g></>;
    }
    const per = 1.4, shown = Math.min(COLORS.length, Math.floor((t - 14.4) / per) + 1), i = Math.min(shown, COLORS.length) - 1;
    return <>{colorFibers(COLORS[Math.max(0, i)][1], 1, 'c')}
        <g>{COLORS.map(([n, c], k) => { const on = k < shown && t >= 14.4; return <g key={n} opacity={on ? 1 : .35}><rect x={80 + k * 88} y="40" width="80" height="32" rx="3" fill="#fff" stroke={on ? '#094732' : '#d6dfd9'}/><circle cx={96 + k * 88} cy="56" r="7" fill={c}/>{on && <path d={`M${106 + k * 88} 56 l4 4 l8 -9`} fill="none" stroke="#1c8a5a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>}</g>; })}</g>
        <Label x={300} y={100} size={14} color="#605e5c" weight={500}>Tú marcas qué colores ofrece cada estilo</Label></>;
}

const PRESETS: [string, CurlShape][] = [['Recta', { curl_deg: 0, bend_position: .5, bend_sharpness: 0 }], ['J', { curl_deg: 25, bend_position: .6, bend_sharpness: .2 }], ['B', { curl_deg: 35, bend_position: .55, bend_sharpness: .2 }], ['C', { curl_deg: 50, bend_position: .5, bend_sharpness: .25 }], ['CC', { curl_deg: 62, bend_position: .5, bend_sharpness: .3 }], ['D', { curl_deg: 72, bend_position: .45, bend_sharpness: .3 }], ['DD', { curl_deg: 85, bend_position: .45, bend_sharpness: .35 }], ['L', { curl_deg: 60, bend_position: .3, bend_sharpness: .9 }]];
const mix = (a: CurlShape, b: CurlShape, k: number): CurlShape => ({ curl_deg: lerp(a.curl_deg, b.curl_deg, k), bend_position: lerp(a.bend_position, b.bend_position, k), bend_sharpness: lerp(a.bend_sharpness, b.bend_sharpness, k) });
/** Manojo de fibras con la curva elegida; el punto dorado marca dónde se dobla. */
function curlBundle(shape: CurlShape, progress: number, key: string, dot = false) {
    const unit = curlPath(shape, 40), sx = 150, rx = 110, ry = BASE;
    const bundle = [{ f: 1, r: -1.6 }, { f: .95, r: -.6 }, { f: .89, r: .5 }, { f: .83, r: 1.6 }, { f: .77, r: 2.7 }, { f: .71, r: 3.8 }];
    const place = (f: number, r: number) => { const c = Math.cos(r * RAD), s = Math.sin(r * RAD); return unit.map(([x, y]) => [rx + sx * f * (x * c - y * s), ry - sx * f * (x * s + y * c)] as Pt); };
    const main = place(1, -1.6), at = main[Math.round(clamp01(shape.bend_position) * (main.length - 1))];
    return <>{bundle.map(({ f, r }, i) => { const pts = place(f, r), n = Math.max(2, Math.round(pts.length * clamp01(progress))); return progress > .001 ? <path key={`${key}${i}`} d={taper(pts.slice(0, n), 3.4, .12, pts.length - 1)} fill="url(#tutInk)" opacity={.95 - i * .06}/> : null; })}
        {dot && <><circle cx={at[0]} cy={at[1]} r="9" fill="#9F8351" opacity=".25"/><circle cx={at[0]} cy={at[1]} r="4.5" fill="#9F8351" stroke="#fff" strokeWidth="1.5"/></>}</>;
}
function Slider({ x, y, label, value, active }: { x: number; y: number; label: string; value: number; active: boolean }) {
    return <g opacity={active ? 1 : .45}><text x={x} y={y - 8} fontSize="12" fontWeight="600" fill="#094732">{label}</text><rect x={x} y={y} width="120" height="6" rx="3" fill="#dfe7e2"/><rect x={x} y={y} width={120 * clamp01(value)} height="6" rx="3" fill="#094732"/><circle cx={x + 120 * clamp01(value)} cy={y + 3} r="7" fill="#094732" stroke="#fff" strokeWidth="2"/></g>;
}
function curlScene(t: number) {
    const base = PRESETS[3][1];
    if (t < 6) return <>{curlBundle(PRESETS[0][1], seg(t, 1, 3.5), 'a')}<Label x={300} y={52} opacity={seg(t, .3, 1)}>La curvatura es la forma de la fibra</Label><Label x={300} y={78} size={13} color="#7a6338" weight={500} opacity={seg(t, 3.5, 4.5)}>desde la base hasta la punta</Label></>;
    if (t < 15) {
        const per = 1.1, i = Math.min(PRESETS.length - 1, Math.floor((t - 6) / per)), local = t - 6 - i * per, shape = mix(PRESETS[Math.max(0, i - 1)][1], PRESETS[i][1], seg(local, 0, .6));
        return <>{curlBundle(shape, 1, 'b')}<Label x={300} y={52} size={22}>{`Curva ${PRESETS[i][0]}`}</Label><Label x={540} y={300} anchor="end" size={20} color="#9F8351">{`${Math.round(shape.curl_deg)}°`}</Label></>;
    }
    if (t < 22) {
        const phase = Math.min(2, Math.floor((t - 15) / 2.33)), local = (t - 15) - phase * 2.33, wave = Math.sin(clamp01(local / 2.33) * Math.PI);
        const shape: CurlShape = phase === 0 ? { ...base, curl_deg: lerp(30, 95, wave) } : phase === 1 ? { ...base, bend_position: lerp(.2, .8, clamp01(local / 2.33)) } : { ...base, bend_sharpness: lerp(0, 1, wave) };
        const texts = ['Grados: cuánto se dobla en total', 'Dónde se dobla: cerca de la base o de la punta', 'Nitidez: curva suave o quiebre marcado'];
        return <>{curlBundle(shape, 1, 'c', phase === 1)}<Label x={300} y={46} size={17}>{texts[phase]}</Label>
            <Slider x={410} y={110} label="Grados" value={shape.curl_deg / 150} active={phase === 0}/><Slider x={410} y={160} label="Dónde se dobla" value={shape.bend_position} active={phase === 1}/><Slider x={410} y={210} label="Nitidez" value={shape.bend_sharpness} active={phase === 2}/></>;
    }
    return <StepCards t={t} start={22.3} items={[{ title: 'Crea', line1: 'grados, dónde', line2: 'dobla, nitidez' }, { title: 'Publica', line1: 'se guarda la', line2: 'versión nueva' }, { title: 'Activa', line1: 'en cada estilo', line2: 'que la ofrezca' }]}/>;
}

// ---------- contenido de cada apartado ----------
interface Chapter { label: string; start: number; caption: string }
interface Tutorial { duration: number; chapters: Chapter[]; scene: (t: number) => ReactNode }
const tutorials: Record<OptionKind, Tutorial> = {
    technique: { duration: 28, scene: techniqueScene, chapters: [
        { label: 'Qué es', start: 0, caption: 'Cada extensión se pega en un punto del párpado: el punto de aplicación.' },
        { label: 'Estructuras', start: 7, caption: 'La técnica decide qué sale de cada punto: una fibra, dos, tres, una Y o un abanico.' },
        { label: 'Técnica y estilo', start: 14, caption: 'El estilo dice dónde va el largo; la técnica, cómo se arma cada grupo. Juntos dan el resultado.' },
        { label: 'Cómo se usa', start: 21, caption: 'Crea la técnica, revísala en 3D, publícala y actívala en cada estilo.' }] },
    length: { duration: 21, scene: lengthScene, chapters: [
        { label: 'Qué es', start: 0, caption: 'El largo es cuánto miden las pestañas, en milímetros.' },
        { label: 'Varios largos', start: 7, caption: 'Puedes tener largos cortos, medios o largos; cada uno se mide en mm.' },
        { label: 'La clienta elige', start: 14, caption: 'Ella escoge entre los largos que dejes disponibles en cada estilo.' }] },
    thickness: { duration: 21, scene: thicknessScene, chapters: [
        { label: 'Qué es', start: 0, caption: 'El grosor es el diámetro de cada fibra. El círculo muestra su corte ampliado.' },
        { label: 'Varios grosores', start: 7, caption: 'Más fino se ve natural; más grueso se ve más marcado.' },
        { label: 'Se combina', start: 14, caption: 'Se combina con el estilo, la técnica y el largo que elija la clienta.' }] },
    color: { duration: 21, scene: colorScene, chapters: [
        { label: 'Qué es', start: 0, caption: 'El color es el tono de las pestañas. El negro es el aspecto aprobado.' },
        { label: 'Varios tonos', start: 7, caption: 'Puedes crear cafés, azules o borgoña para que la clienta los pruebe.' },
        { label: 'Tú decides', start: 14, caption: 'Marca qué colores ofrece cada estilo; los demás no aparecen.' }] },
    curl: { duration: 26, scene: curlScene, chapters: [
        { label: 'Qué es', start: 0, caption: 'La curvatura es la forma de la fibra, desde la base hasta la punta.' },
        { label: 'Curvas conocidas', start: 6, caption: 'Recta, J, B, C, CC, D, DD o L: cada una dobla distinto.' },
        { label: 'Tres ajustes', start: 15, caption: 'Grados, dónde se dobla y qué tan marcado es el doblez.' },
        { label: 'Cómo se usa', start: 22, caption: 'Crea la curva, publícala y actívala en cada estilo.' }] },
};

// ---------- Estilos y efectos ----------
const LID_X0 = 70, LID_W = 460;
const lidAt = (u: number) => 228 + 18 * Math.sin(Math.PI * u);
const smooth01 = (n: number) => ease(n);
type Profile = (u: number) => number;
const PROFILES: [string, Profile][] = [
    ['Parejo', () => 88],
    ['Cat Eye: más largo hacia afuera', u => 56 + 86 * Math.pow(u, 1.4)],
    ['Muñeca: más largo al centro', u => 58 + 76 * Math.pow(Math.sin(Math.PI * u), .8)],
];
/** Tira de grupos de 3 fibras sobre el párpado, con el largo que marque `profile`. */
function strip(profile: Profile, n: number, key: string, o: { fan?: number; spikeEvery?: number; spikeMult?: number; prog?: (i: number) => number } = {}): ReactNode[] {
    const out: ReactNode[] = [], fan = o.fan ?? 8;
    for (let i = 0; i < n; i++) {
        const u = n === 1 ? .5 : i / (n - 1), x = LID_X0 + LID_W * u, y = lidAt(u), p = o.prog ? o.prog(i) : 1;
        if (p <= .001) continue;
        const spike = o.spikeEvery && i % o.spikeEvery === 0 ? o.spikeMult ?? 1 : 1, len = profile(u) * (.5 + .5 * smooth01(u / .16)) * spike, lean = (u - .5) * fan * 1.4 + 6;
        [-1, 0, 1].forEach(k => { const f = fiber(`${key}${i}${k}`, x, y, len * (1 - .05 * Math.abs(k)), lean + k * (fan * .5 + 2), k * 6 + 6, 2.6, p); if (f) out.push(f); });
    }
    return out;
}
function stylesScene(t: number) {
    if (t < 7) {
        const n = 11;
        return <>{strip(PROFILES[1][1], n, 'a', { prog: i => seg(t, 1 + i * .2, 2.4 + i * .2) })}
            <Label x={300} y={50} size={19} opacity={seg(t, .3, 1)}>Un estilo es el diseño completo de la mirada</Label>
            <Label x={300} y={76} size={13} color="#7a6338" weight={500} opacity={seg(t, 3.5, 4.5)}>Dónde va el largo, cuánto se curva y cuánto se abre</Label></>;
    }
    if (t < 15) {
        const per = 2.6, i = Math.min(2, Math.floor((t - 7) / per)), local = t - 7 - i * per, k = seg(local, 0, 1.1), prev = PROFILES[Math.max(0, i - 1)][1], cur = PROFILES[i][1];
        const profile: Profile = u => lerp(i === 0 ? 70 : prev(u), cur(u), k), pts = [0, .18, .35, .85, 1];
        return <>{strip(profile, 11, 'b')}
            {pts.map(u => { const x = LID_X0 + LID_W * u, y = lidAt(u) - profile(u) * (.5 + .5 * smooth01(u / .16)) - 8; return <circle key={u} cx={x + (u - .5) * 12} cy={y} r="5.5" fill="#9F8351" stroke="#fff" strokeWidth="2"/>; })}
            <Label x={300} y={46} size={18}>{PROFILES[i][0]}</Label>
            <Label x={LID_X0} y={296} size={12} color="#605e5c" weight={500} anchor="start">Lagrimal</Label><Label x={LID_X0 + LID_W} y={296} size={12} color="#605e5c" weight={500} anchor="end">Extremo exterior</Label>
            <Label x={300} y={74} size={13} color="#7a6338" weight={500}>Cada punto dorado controla el largo de una zona</Label></>;
    }
    if (t < 23) {
        const phase = Math.min(2, Math.floor((t - 15) / 2.66)), local = (t - 15) - phase * 2.66, wave = Math.sin(clamp01(local / 2.66) * Math.PI);
        const profile = PROFILES[1][1];
        const opts = phase === 0 ? { fan: lerp(0, 34, wave) } : phase === 1 ? { fan: 8, spikeEvery: 3, spikeMult: lerp(1, 1.7, wave) } : { fan: 8 };
        const n = phase === 2 ? Math.round(lerp(8, 15, wave)) : 11;
        const texts = ['Apertura: hacia dónde se abren las fibras', 'Picos: un grupo más largo cada cierto número', 'Relleno: más grupos para un look más tupido'];
        return <>{strip(profile, n, `c${phase}`, opts)}<Label x={300} y={50} size={18}>{texts[phase]}</Label></>;
    }
    if (t < 29) {
        const rows = ['Largo', 'Técnica', 'Grosor', 'Color', 'Curvatura'], sample = [['Corto', 'Medio', 'Largo'], ['Clásica', 'Volumen', '3D'], ['0.07', '0.15'], ['Negro', 'Café'], ['C', 'D']];
        return <g>{rows.map((r, i) => { const a = seg(t, 23.4 + i * .8, 24.1 + i * .8); return <g key={r} opacity={a} transform={`translate(0 ${(1 - a) * 10})`}>
            <text x="70" y={92 + i * 40} fontSize="14" fontWeight="700" fill="#094732">{r}</text>
            {sample[i].map((c, k) => <g key={c}><rect x={170 + k * 100} y={72 + i * 40} width="88" height="26" rx="3" fill="#eef6f1" stroke="#094732"/><path d={`M${180 + k * 100} ${85 + i * 40} l4 4 l8 -9`} fill="none" stroke="#094732" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><text x={198 + k * 100} y={90 + i * 40} fontSize="12.5" fontWeight="600" fill="#094732">{c}</text></g>)}
        </g>; })}<Label x={300} y={48} size={18} opacity={seg(t, 23.2, 24)}>Tú eliges qué podrá probar la clienta</Label></g>;
    }
    return <StepCards t={t} start={29.4} items={[{ title: 'Crea', line1: 'nombre y forma', line2: 'del diseño' }, { title: 'Prueba', line1: 'en la vista 3D', line2: 'del editor' }, { title: 'Guarda', line1: 'un borrador, sin', line2: 'afectar al salón' }, { title: 'Publica', line1: 'aparece al abrir', line2: 'el probador' }]}/>;
}
const stylesTutorial: Tutorial = { duration: 36, scene: stylesScene, chapters: [
    { label: 'Qué es', start: 0, caption: 'Un estilo es el diseño completo de la mirada que la clienta puede probarse.' },
    { label: 'Forma', start: 7, caption: 'Cada punto dorado controla el largo de una zona: así se logra Cat Eye, muñeca o parejo.' },
    { label: 'Acabado', start: 15, caption: 'Además se ajusta la apertura de las fibras, los picos y qué tan relleno se ve.' },
    { label: 'Opciones', start: 23, caption: 'Eliges qué largos, técnicas, grosores, colores y curvaturas puede combinar con este estilo.' },
    { label: 'Publicar', start: 29, caption: 'Crea, prueba, guarda un borrador y publica. Después aparece al abrir el probador.' }] };

const timestamp = (n: number) => `0:${Math.floor(n).toString().padStart(2, '0')}`;
const titles: Record<OptionKind, string> = { technique: 'Técnicas', length: 'Largos', thickness: 'Grosores', color: 'Colores', curl: 'Curvaturas' };

function Player({ eyebrow, tutorial, onClose }: { eyebrow: string; tutorial: Tutorial; onClose: () => void }) {
    const { duration, chapters, scene } = tutorial, id = useId(), close = useRef<HTMLButtonElement>(null);
    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const [seconds, setSeconds] = useState(reduce ? 5 : 0), [playing, setPlaying] = useState(!reduce), time = useRef(reduce ? 5 : 0);
    const chapter = chapters.reduce((found, c, i) => seconds >= c.start ? i : found, 0);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        close.current?.focus();
        return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    useEffect(() => {
        if (!playing) return;
        let raf = 0, last = performance.now();
        const tick = (now: number) => {
            time.current = Math.min(duration, time.current + Math.min((now - last) / 1000, .1));
            last = now;
            setSeconds(time.current);
            if (time.current >= duration) { setPlaying(false); return; }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing, duration]);
    useEffect(() => {
        const pause = () => { if (document.hidden) setPlaying(false); };
        document.addEventListener('visibilitychange', pause);
        return () => document.removeEventListener('visibilitychange', pause);
    }, []);
    const seek = (value: number) => { time.current = value; setSeconds(value); };
    const playPause = () => { if (playing) setPlaying(false); else { if (time.current >= duration) seek(0); setPlaying(true); } };
    const button = 'rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]';
    return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-[#9F8351] bg-[#094732] px-5 py-3.5 text-white"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">{eyebrow}</p><h2 id={id} className="mt-1 text-lg font-semibold leading-tight">{chapters[chapter].label}</h2></div><button ref={close} type="button" className="shrink-0 rounded-sm p-1.5 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8c7a4]" aria-label="Cerrar tutorial" onClick={onClose}><X size={18}/></button></header>
            <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
                <div className="relative overflow-hidden rounded-sm border border-[#dce5df] bg-gradient-to-br from-[#fdf8f1] to-[#f1e4d5]">
                    <svg viewBox="0 0 600 340" className="mx-auto block h-auto max-h-[52dvh] w-full" role="img" aria-label={chapters[chapter].caption}>
                        <defs><linearGradient id="tutInk" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#14100d"/><stop offset=".7" stopColor="#241d18"/><stop offset="1" stopColor="#5a4c42"/></linearGradient></defs>
                        <Ground/>{scene(seconds)}
                    </svg>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f1e4d5] via-[#f1e4d5]/85 to-transparent px-4 pb-3 pt-8 text-center"><p className="text-sm font-semibold text-[#094732] sm:text-base">{chapters[chapter].caption}</p></div>
                </div>
                <div className="mt-3 flex items-center gap-2 sm:gap-3"><button type="button" className={`${button} shrink-0`} aria-label={playing ? 'Pausar tutorial' : 'Reproducir tutorial'} onClick={playPause}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button><button type="button" className={`${button} shrink-0`} aria-label="Repetir tutorial" onClick={() => { seek(0); setPlaying(true); }}><RotateCcw size={17}/></button><input aria-label="Progreso del tutorial" type="range" min={0} max={duration} step={.1} value={seconds} onChange={e => seek(Number(e.target.value))} className="min-w-0 flex-1 accent-[#094732]"/><output aria-label="Tiempo del tutorial" className="shrink-0 text-xs tabular-nums text-[#605e5c]">{timestamp(seconds)} / {timestamp(duration)}</output></div>
                <div className="mt-3 flex overflow-hidden rounded-sm border border-[#d6dfd9] bg-[#f6f8f6]" role="group" aria-label="Capítulos del tutorial">{chapters.map((c, i) => <button type="button" key={c.label} className={`min-w-0 flex-1 px-2 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732] ${i ? 'border-l border-[#d6dfd9]' : ''} ${chapter === i ? 'bg-[#094732] text-white' : 'text-[#094732] hover:bg-[#eaf4ef]'}`} aria-pressed={chapter === i} onClick={() => { seek(c.start + .3); setPlaying(true); }}>{c.label}</button>)}</div>
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#edebe9] bg-[#f6f8f6] px-4 py-3"><p className="text-xs text-[#605e5c]">Es solo una demostración: no modifica nada.</p><button type="button" className="rounded-sm bg-[#094732] px-4 py-2 text-sm text-white hover:bg-[#0d5b40]" onClick={onClose}>Entendido</button></footer>
        </div>
    </div>, document.body);
}

export default function SectionTutorialDialog({ kind, onClose }: { kind: OptionKind; onClose: () => void }) {
    return <Player eyebrow={`Cómo funciona · ${titles[kind]}`} tutorial={tutorials[kind]} onClose={onClose}/>;
}
export function StylesTutorialDialog({ onClose }: { onClose: () => void }) {
    return <Player eyebrow="Cómo funciona · Estilos y efectos" tutorial={stylesTutorial} onClose={onClose}/>;
}
