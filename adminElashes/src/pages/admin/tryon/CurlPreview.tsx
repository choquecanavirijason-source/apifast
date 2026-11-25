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
    // Posición y nitidez no se notan en una fibra recta: la demo usa al menos 60°.
    const base = helpKey === 'curl_deg' ? shape : { ...shape, curl_deg: Math.max(shape.curl_deg, 60) };
    const animated = { ...base, [helpKey]: value };
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
                        ? <div className="grid grid-cols-2 gap-2">{[topic.low, topic.high].map(v => <div key={v}><CurlPreview shape={{ ...base, [helpKey]: v }}/><p className="mt-1 text-center text-xs tabular-nums text-[#605e5c]">{topic.format(v)}</p></div>)}</div>
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
 * Vista lateral para el editor y los tutoriales: un manojo de fibras finas que
 * nacen del mismo punto, con la misma escala siempre (la que cabe la curva más
 * pronunciada), de modo que solo cambia la curvatura. El punto dorado marca
 * dónde se dobla la fibra.
 */
const referenceShapes: CurlShape[] = [...curlPresets.map(c => c.shape), { curl_deg: 150, bend_position: .15, bend_sharpness: 1 }, { curl_deg: 150, bend_position: .85, bend_sharpness: 0 }];
const referenceExtent = (() => {
    const all = referenceShapes.flatMap(sh => curlPath(sh, 40));
    return { x: Math.max(...all.map(q => q[0])), y: Math.max(...all.map(q => q[1])) };
})();
export default function CurlPreview({ shape }: { shape: CurlShape }) {
    const W = 340, H = 240, deg = Math.PI / 180;
    const scale = Math.min(250 / referenceExtent.x, 150 / referenceExtent.y);
    const rx = (W - scale * referenceExtent.x) / 2, ry = (H + scale * referenceExtent.y) / 2 - 6;
    const unit = curlPath(shape, 48);
    const bundle = [{ f: 1, r: -1.6 }, { f: .95, r: -.6 }, { f: .89, r: .5 }, { f: .83, r: 1.6 }, { f: .77, r: 2.7 }, { f: .71, r: 3.8 }];
    const place = (f: number, r: number) => { const c = Math.cos(r * deg), sn = Math.sin(r * deg); return unit.map(([x, y]) => [rx + scale * f * (x * c - y * sn), ry - scale * f * (x * sn + y * c)] as const); };
    const fiber = ({ f, r }: { f: number; r: number }, i: number) => {
        const line = place(f, r), m = line.length;
        const edge = (sign: number) => line.map(([x, y], j) => {
            const q0 = line[Math.max(0, j - 1)], q1 = line[Math.min(m - 1, j + 1)], dx = q1[0] - q0[0], dy = q1[1] - q0[1], d = Math.hypot(dx, dy) || 1, w = 3.4 * Math.pow(1 - j / (m - 1), 1.1) + .1;
            return `${(x + sign * (-dy / d) * w / 2).toFixed(1)} ${(y + sign * (dx / d) * w / 2).toFixed(1)}`;
        });
        return <path key={i} fill="url(#curlPreviewFiber)" opacity={.95 - i * .06} d={`M${[...edge(1), ...edge(-1).reverse()].join('L')}Z`}/>;
    };
    const main = place(1, -1.6), bend = main[Math.round(Math.max(0, Math.min(1, shape.bend_position)) * (main.length - 1))];
    return <div className="rounded-sm border border-[#edebe9] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]">Vista lateral de la fibra</p>
        <div className="overflow-hidden rounded-sm bg-gradient-to-br from-[#fdf8f1] to-[#f1e4d5]">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Fibra de perfil con curvatura ${Math.round(shape.curl_deg)} grados`}>
                <defs>
                    <linearGradient id="curlPreviewFiber" gradientUnits="userSpaceOnUse" x1={rx} y1="0" x2={rx + 250} y2="0"><stop offset="0" stopColor="#2b211b"/><stop offset=".7" stopColor="#4a3c33"/><stop offset="1" stopColor="#7a6a5e"/></linearGradient>
                    <filter id="curlPreviewBlur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="5"/></filter>
                </defs>
                <ellipse cx={rx + 120} cy={ry + 6} rx="135" ry="6" fill="#6b4a32" opacity=".22" filter="url(#curlPreviewBlur)"/>
                {bundle.map(fiber)}
                <circle cx={bend[0]} cy={bend[1]} r="7" fill="#9F8351" opacity=".2"/>
                <circle cx={bend[0]} cy={bend[1]} r="3.2" fill="#9F8351" stroke="#fff" strokeWidth="1.2"/>
                <text x={W - 14} y={H - 14} textAnchor="end" fontSize="22" fontWeight="600" fill="#9F8351">{Math.round(shape.curl_deg)}°</text>
            </svg>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[#605e5c]">Todas las fibras nacen del mismo punto y se dibujan a la misma escala, así solo cambia la curvatura. El punto dorado marca dónde se dobla.</p>
    </div>;
}
