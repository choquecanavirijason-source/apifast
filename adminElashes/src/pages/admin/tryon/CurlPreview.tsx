import { useEffect, useState } from 'react';

import { curlPath } from './curlShape';
import type { CurlShape } from './curlShape';
export type { CurlShape } from './curlShape';
export { curlPath } from './curlShape';

/** Curvaturas de referencia de las bandejas del salón. */
export const curlPresets: { name: string; shape: CurlShape }[] = [
    { name: 'Recta', shape: { curl_deg: 0, bend_position: .5, bend_sharpness: 0 } },
    { name: 'J', shape: { curl_deg: 25, bend_position: .6, bend_sharpness: .2 } },
    { name: 'B', shape: { curl_deg: 35, bend_position: .55, bend_sharpness: .2 } },
    { name: 'C', shape: { curl_deg: 50, bend_position: .5, bend_sharpness: .25 } },
    { name: 'CC', shape: { curl_deg: 62, bend_position: .5, bend_sharpness: .3 } },
    { name: 'D', shape: { curl_deg: 72, bend_position: .45, bend_sharpness: .3 } },
    { name: 'DD', shape: { curl_deg: 85, bend_position: .45, bend_sharpness: .35 } },
    { name: 'L', shape: { curl_deg: 60, bend_position: .3, bend_sharpness: .9 } },
    { name: 'LC', shape: { curl_deg: 72, bend_position: .3, bend_sharpness: .7 } },
];

const toSvg = (pts: [number, number][], scale: number, ox: number, oy: number) =>
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + x * scale).toFixed(1)} ${(oy - y * scale).toFixed(1)}`).join(' ');

/** Ícono pequeño para la tabla. */
export function CurlGlyph({ shape, size = 28 }: { shape: CurlShape; size?: number }) {
    const d = toSvg(curlPath(shape, 24), size * .8, size * .12, size * .9);
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
        <path d={d} fill="none" stroke="#094732" strokeWidth={1.8} strokeLinecap="round"/>
    </svg>;
}

export type CurlHelpKey = 'curl_deg' | 'bend_position' | 'bend_sharpness';
export const curlHelpKeys: CurlHelpKey[] = ['curl_deg', 'bend_position', 'bend_sharpness'];

const curlHelpTopics: Record<CurlHelpKey, { title: string; description: string; less: string; more: string; tip: string; low: number; high: number; format: (v: number) => string }> = {
    curl_deg: {
        title: 'Curvatura total',
        description: 'Cuánto se dobla la fibra de la base a la punta.',
        less: 'Más recta: la fibra sigue la dirección en que nace.',
        more: 'Más curva: la punta se levanta hacia el párpado.',
        tip: '0° es una fibra recta (STRAIGHT). Una C ronda los 50° y una D los 70°; por encima de 100° puedes crear ultracurvas.',
        low: 0, high: 100, format: v => `${Math.round(v)}°`,
    },
    bend_position: {
        title: 'Dónde se dobla',
        description: 'En qué parte de la fibra se concentra el doblez.',
        less: 'Cerca de la base: dobla pronto y el resto queda recto.',
        more: 'Cerca de la punta: la fibra va recta y dobla al final.',
        tip: 'Las curvas en L doblan cerca de la base (≈0.3). Las curvas J doblan más hacia la punta (≈0.6).',
        low: .15, high: .85, format: v => v.toFixed(2),
    },
    bend_sharpness: {
        title: 'Nitidez del doblez',
        description: 'Si el doblez es una curva suave o un quiebre marcado.',
        less: 'Gradual: la curva se reparte a lo largo de la fibra (C, D).',
        more: 'Quiebre: el doblez ocurre en un tramo corto (L, LC).',
        tip: 'Combínalo con "Dónde se dobla": un quiebre cerca de la base da la forma en L.',
        low: 0, high: 1, format: v => v.toFixed(2),
    },
};

/**
 * Tutorial de un parámetro de la curvatura: explicación y la fibra animada
 * entre un valor bajo y uno alto, partiendo de la curva que se está editando.
 * Respeta "reducir movimiento" (muestra los dos extremos quietos).
 */
export function CurlHelpDialog({ helpKey, shape, onClose, onNavigate }: {
    helpKey: CurlHelpKey;
    shape: CurlShape;
    onClose: () => void;
    onNavigate: (key: CurlHelpKey) => void;
}) {
    const topic = curlHelpTopics[helpKey];
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const [phase, setPhase] = useState(0);
    const [playing, setPlaying] = useState(!reduceMotion);
    useEffect(() => {
        if (!playing) return;
        let frame = 0;
        const start = performance.now() - phase * 4000;
        const tick = (now: number) => {
            setPhase(((now - start) / 4000) % 1);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, helpKey]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    // Va y vuelve entre el valor bajo y el alto.
    const t = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const value = topic.low + (topic.high - topic.low) * t;
    const animated = { ...shape, [helpKey]: value };
    const index = curlHelpKeys.indexOf(helpKey);
    const go = (step: number) => onNavigate(curlHelpKeys[(index + step + curlHelpKeys.length) % curlHelpKeys.length]);
    return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={topic.title} onClick={onClose}>
        <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-md bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-[#edebe9] px-5 py-4">
                <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9F8351]">Curvatura · {index + 1} de {curlHelpKeys.length}</p><h3 className="mt-0.5 text-lg font-semibold text-[#094732]">{topic.title}</h3><p className="mt-1 text-sm text-[#605e5c]">{topic.description}</p></div>
                <button type="button" className="rounded-full px-2 py-1 text-sm text-[#605e5c] hover:bg-[#f3f2f1]" onClick={onClose} aria-label="Cerrar">✕</button>
            </div>
            <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                    {reduceMotion
                        ? <div className="grid grid-cols-2 gap-2">{[topic.low, topic.high].map(v => <div key={v}><CurlPreview shape={{ ...shape, [helpKey]: v }}/><p className="mt-1 text-center text-xs tabular-nums text-[#605e5c]">{topic.format(v)}</p></div>)}</div>
                        : <><CurlPreview shape={animated}/><div className="mt-2 flex items-center gap-3"><button type="button" className="rounded-sm border border-[#094732] px-3 py-1 text-xs font-semibold text-[#094732] hover:bg-[#eef6f1]" onClick={() => setPlaying(p => !p)}>{playing ? 'Pausar' : 'Reproducir'}</button><span className="text-sm font-semibold tabular-nums text-[#323130]">{topic.format(value)}</span></div></>}
                </div>
                <div className="space-y-3 text-sm">
                    <p><span className="font-semibold text-[#323130]">Al bajarlo: </span><span className="text-[#605e5c]">{topic.less}</span></p>
                    <p><span className="font-semibold text-[#323130]">Al subirlo: </span><span className="text-[#605e5c]">{topic.more}</span></p>
                    <p className="rounded-sm bg-[#eef6f1] px-3 py-2 text-xs leading-relaxed text-[#2f5a48]">{topic.tip}</p>
                    <p className="text-xs text-[#605e5c]">Tu valor actual: <span className="font-semibold tabular-nums">{topic.format(shape[helpKey])}</span></p>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#edebe9] px-5 py-3">
                <button type="button" className="rounded-sm px-3 py-1.5 text-sm text-[#094732] hover:bg-[#eef6f1]" onClick={() => go(-1)}>Anterior</button>
                <button type="button" className="rounded-sm bg-[#094732] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0b5a40]" onClick={onClose}>Entendido</button>
                <button type="button" className="rounded-sm px-3 py-1.5 text-sm text-[#094732] hover:bg-[#eef6f1]" onClick={() => go(1)}>Siguiente</button>
            </div>
        </div>
    </div>;
}

/**
 * Vista lateral grande para el editor: perfil de un ojo (globo, iris al
 * frente y párpado superior) con las fibras naciendo en el borde del
 * párpado, en tres largos. El tamaño se ajusta para que ninguna fibra se
 * salga del recuadro, sea recta o muy curva.
 */
export default function CurlPreview({ shape }: { shape: CurlShape }) {
    const W = 340, H = 240;
    // Ojo de perfil mirando a la derecha (hacia la cámara).
    const eye = { x: 92, y: 158, r: 50 };
    const rad = (deg: number) => deg * Math.PI / 180;
    const onEye = (deg: number, r = eye.r) => [eye.x + r * Math.cos(rad(deg)), eye.y + r * Math.sin(rad(deg))] as const;
    // Borde del párpado (donde nacen las pestañas): arriba y al frente del ojo.
    const [rx, ry] = onEye(-38);
    const [bx, by] = onEye(-160, eye.r + 4);
    const [tx, ty] = onEye(-90, eye.r + 16);
    const [fx, fy] = onEye(-38, eye.r + 6);
    const lid = `M${bx.toFixed(1)} ${by.toFixed(1)} Q ${tx.toFixed(1)} ${(ty - 10).toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} A ${eye.r} ${eye.r} 0 0 0 ${onEye(-160)[0].toFixed(1)} ${onEye(-160)[1].toFixed(1)} Z`;
    // Escala que deja la fibra más larga dentro del recuadro (margen 12 px).
    const path = curlPath(shape);
    const maxX = Math.max(...path.map(p => p[0])), maxY = Math.max(...path.map(p => p[1]));
    const minX = Math.min(...path.map(p => p[0]));
    const scale = Math.min(150, (W - 12 - rx) / Math.max(maxX, 1e-6), (ry - 12) / Math.max(maxY, 1e-6), minX < 0 ? (rx - 12) / -minX : Infinity);
    const fibers = [1, .8, .6].map((len, i) => ({ len, opacity: 1 - i * .3 }));
    return <div className="rounded-sm border border-[#edebe9] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]">Vista lateral del ojo</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Ojo de perfil con una pestaña de curvatura ${Math.round(shape.curl_deg)} grados`}>
            {/* Globo ocular con el iris al frente. */}
            <circle cx={eye.x} cy={eye.y} r={eye.r} fill="#ffffff" stroke="#d6cfc8" strokeWidth={2}/>
            <path d={`M${onEye(-28)[0]} ${onEye(-28)[1]} A ${eye.r * .55} ${eye.r * .55} 0 0 1 ${onEye(28)[0]} ${onEye(28)[1]}`} fill="#7a5233" stroke="#5a3a22" strokeWidth={1.5}/>
            {/* Párpado superior: la piel cubre la parte de arriba del ojo. */}
            <path d={lid} fill="#e2b99a" stroke="#c8987a" strokeWidth={1.5} strokeLinejoin="round"/>
            {/* Pestañas desde el borde del párpado. */}
            {fibers.map(({ len, opacity }) =>
                <path key={len} d={toSvg(path, scale * len, rx, ry)} fill="none" stroke="#1b1b1b" strokeOpacity={opacity} strokeWidth={len === 1 ? 3 : 2} strokeLinecap="round"/>)}
            <circle cx={rx} cy={ry} r={3} fill="#9F8351"/>
            {/* Etiquetas. */}
            <text x={tx - 46} y={ty - 12} fontSize={11} fill="#8a6a50">Párpado</text>
            <text x={eye.x - 22} y={eye.y + eye.r + 18} fontSize={11} fill="#8a8886">Ojo</text>
            <text x={W - 8} y={H - 10} textAnchor="end" fontSize={11} fill="#8a8886">hacia la cámara →</text>
        </svg>
        <p className="mt-1 text-[11px] leading-snug text-[#605e5c]">El punto dorado es donde nace la pestaña. La fibra sale hacia adelante y se dobla hacia arriba, igual que en el probador.</p>
    </div>;
}
