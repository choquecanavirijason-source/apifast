import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import type { LengthPoint } from '@/core/services/tryon/tryon.service';

/**
 * Tutorial del perfil de largo: cada punto del control es el largo de una
 * zona de la tira, del lagrimal (izquierda) a la esquina exterior (derecha).
 * Anima el punto elegido entre un valor bajo y uno alto sobre tu perfil real.
 * No modifica el diseño.
 */
const W = 600, H = 250, X0 = 50, X1 = 550, PX = 120;
const lashY = (t: number) => 38 + 46 * (1 - (2 * t - 1) ** 2);
const MIN = .08, MAX = 1.2, CYCLE = 4;

function interpolate(points: LengthPoint[], t: number) {
    for (let i = 1; i < points.length; i++) {
        if (t <= points[i].t) {
            const a = points[i - 1], b = points[i], k = (t - a.t) / Math.max(b.t - a.t, 1e-6);
            return a.length + (b.length - a.length) * k;
        }
    }
    return points[points.length - 1].length;
}

export default function ShapeTutorialDialog({ points, focus, onFocus, onClose }: {
    points: LengthPoint[];
    focus: number;
    onFocus: (index: number) => void;
    onClose: () => void;
}) {
    const id = useId(), close = useRef<HTMLButtonElement>(null);
    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const [playing, setPlaying] = useState(!reduce), [phase, setPhase] = useState(reduce ? .5 : 0);
    const index = Math.min(Math.max(focus, 0), points.length - 1), last = points.length - 1;
    const name = (i: number) => i === 0 ? 'Lagrimal' : i === last ? 'Extremo exterior' : `Zona ${Math.round(points[i].t * 100)}%`;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        close.current?.focus();
        return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);
    useEffect(() => {
        if (!playing) return;
        let raf = 0;
        const start = performance.now() - phase * CYCLE * 1000;
        const tick = (now: number) => { setPhase(((now - start) / (CYCLE * 1000)) % 1); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]);
    // Va y vuelve entre un largo corto y uno largo, centrado en una escala clara.
    const k = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const value = .2 + (1 - .2) * k;
    const shown = points.map((p, i) => i === index ? { ...p, length: value } : p);
    const fibers = Array.from({ length: 41 }, (_, i) => i / 40);
    const x = (t: number) => X0 + (X1 - X0) * t;
    const lid = fibers.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${lashY(t).toFixed(1)}`).join(' ');
    const near = (t: number) => {
        const p = points[index];
        const left = index > 0 ? points[index - 1].t : p.t, right = index < last ? points[index + 1].t : p.t;
        return t >= left && t <= right ? 1 - Math.abs(t - p.t) / Math.max(t < p.t ? p.t - left : right - p.t, 1e-6) : 0;
    };
    const step = (d: number) => onFocus((index + d + points.length) % points.length);
    const btn = 'rounded-sm border border-[#edebe9] bg-white px-3 py-1.5 text-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]';
    return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-[#9F8351] bg-[#094732] px-5 py-3.5 text-white"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">Tutorial visual · {index + 1} de {points.length}</p><h2 id={id} className="mt-1 text-lg font-semibold leading-tight">Perfil del diseño: {name(index)}</h2></div><button ref={close} type="button" className="shrink-0 rounded-sm p-1.5 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8c7a4]" aria-label="Cerrar ayuda" onClick={onClose}><X size={18}/></button></header>
            <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
                <p className="mb-3 text-sm text-[#605e5c]">Cada punto es el largo de una parte de la tira, del lagrimal (izquierda) a la esquina exterior (derecha). Al mover uno, las pestañas de esa zona suben o bajan y las vecinas lo siguen suavemente.</p>
                <div className="overflow-hidden rounded-sm border border-[#dce5df] bg-[#f7efe8]">
                    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto max-h-[34dvh] w-full" role="img" aria-label={`Perfil de largo; ${name(index)} en ${value.toFixed(2)}`}>
                        <path d={lid} fill="none" stroke="#d9b9a0" strokeWidth={9} strokeLinecap="round" opacity={.55}/>
                        {fibers.map(t => {
                            const len = interpolate(shown, t) * PX, y = lashY(t), drift = (t - .5) * .45 * len, w = near(t);
                            return <line key={t} x1={x(t)} y1={y} x2={x(t) + drift} y2={y + len} stroke={w > 0 ? '#9F8351' : '#2a2320'} strokeOpacity={w > 0 ? .45 + .55 * w : .75} strokeWidth={w > .5 ? 3 : 2} strokeLinecap="round"/>;
                        })}
                        <path d={lid} fill="none" stroke="#2a2320" strokeWidth={3} strokeLinecap="round"/>
                        {points.map((p, i) => <g key={i}><circle cx={x(p.t)} cy={lashY(p.t) - 14} r={i === index ? 7 : 4} fill={i === index ? '#9F8351' : '#094732'} stroke="#fff" strokeWidth={2}/>{i === index && <text x={x(p.t)} y={lashY(p.t) - 28} textAnchor="middle" fontSize={13} fontWeight={700} fill="#094732">{name(i)}</text>}</g>)}
                        <text x={X0} y={H - 10} fontSize={12} fill="#8a6a50">Lagrimal</text>
                        <text x={X1} y={H - 10} textAnchor="end" fontSize={12} fill="#8a6a50">Esquina exterior</text>
                    </svg>
                </div>
                <div className="mt-3 flex items-center gap-3"><button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={() => setPlaying(p => !p)}>{playing ? <><Pause size={14}/>Pausar</> : <><Play size={14}/>Reproducir</>}</button><span className="text-sm font-semibold tabular-nums text-[#323130]">{value.toFixed(2)}</span><span className="text-xs text-[#605e5c]">Tu valor actual: <b className="tabular-nums">{points[index].length.toFixed(2)}</b> (rango {MIN}–{MAX})</span></div>
                <div className="mt-3 space-y-2 text-sm">
                    <p><b className="text-[#323130]">Al bajarlo: </b><span className="text-[#605e5c]">las pestañas de esta zona se acortan.</span></p>
                    <p><b className="text-[#323130]">Al subirlo: </b><span className="text-[#605e5c]">se alargan; esta zona sobresale más que el resto.</span></p>
                    <p className="rounded-sm bg-[#eef6f1] px-3 py-2 text-xs leading-relaxed text-[#2f5a48]">Para un Cat Eye sube los puntos cercanos a la esquina exterior; para un look muñeca, los del centro. Si prefieres no empezar de cero, usa «Partir de otro estilo». Son largos relativos: el largo real (mm) lo define la escala del largo elegido.</p>
                </div>
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#edebe9] bg-[#f6f8f6] px-4 py-3"><p className="text-xs text-[#605e5c]">La demostración no modifica tu diseño.</p><div className="flex flex-wrap gap-2"><button type="button" className={`${btn} inline-flex items-center gap-1`} onClick={() => step(-1)}><ChevronLeft size={14}/>Anterior</button><button type="button" className={`${btn} inline-flex items-center gap-1`} onClick={() => step(1)}>Siguiente<ChevronRight size={14}/></button><button type="button" className="rounded-sm bg-[#094732] px-4 py-1.5 text-sm text-white hover:bg-[#0d5b40]" onClick={onClose}>Entendido</button></div></footer>
        </div>
    </div>, document.body);
}
