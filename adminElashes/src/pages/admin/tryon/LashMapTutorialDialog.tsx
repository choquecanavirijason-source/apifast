import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { MAP_VALUE_MAX, MAP_VALUE_MIN } from './lashMap';

/**
 * Tutorial animado del mapeo para la técnica: un ojo cerrado con el mapeo
 * dibujado sobre el parche (como lo ve la operaria en el asistente) y los
 * números subiendo y bajando según el largo. Mismo formato que
 * VisualTutorialDialog, pero sin 3D: el mapeo no cambia las pestañas.
 */
const DURATION = 24;
const BASE = [9, 10, 11, 12, 13, 14];
const timestamp = (n: number) => `0:${Math.floor(n).toString().padStart(2, '0')}`;
const ease = (t: number) => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const clampMm = (mm: number) => Math.max(MAP_VALUE_MIN, Math.min(MAP_VALUE_MAX, mm));

type Chapter = { start: number; label: string; caption: string };

function chapters(userOffset: number): Chapter[] {
    const sign = userOffset > 0 ? '+' : '';
    return [
        { start: 0, label: 'Medio', caption: 'El estilo define su mapeo para el largo Medio' },
        { start: 6, label: 'Corto', caption: 'Corto (−2 mm): bajan todos los números por igual' },
        { start: 12, label: 'Largo', caption: 'Largo (+2 mm): suben todos los números por igual' },
        { start: 18, label: 'Tu ajuste', caption: `Con tu ajuste (${sign}${userOffset} mm) — la forma del estilo no cambia` },
    ];
}

/** Desplazamiento mostrado en el segundo `s`: tramos fijos unidos por transiciones suaves. */
function offsetAt(s: number, userOffset: number) {
    const stops: [number, number, number][] = [[6, 8, 0], [12, 14, -2], [18, 20, 2]];
    const targets = [-2, 2, userOffset];
    let value = 0;
    stops.forEach(([from, to, prev], i) => {
        if (s >= to) value = targets[i];
        else if (s > from) value = prev + (targets[i] - prev) * ease((s - from) / (to - from));
    });
    return value;
}

/** Punto y normal (hacia la mejilla) de la curva cuadrática del parche. */
function along(t: number) {
    const p0 = { x: 160, y: 150 }, c = { x: 300, y: 205 }, p1 = { x: 440, y: 150 };
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y;
    const dx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    const len = Math.hypot(dx, dy);
    return { x, y, tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len };
}

function Stage({ seconds, offset }: { seconds: number; offset: number }) {
    const values = BASE.map(mm => clampMm(mm + offset));
    const peak = values.indexOf(Math.max(...values));
    return <svg viewBox="0 0 600 360" className="block h-auto w-full" role="img" aria-label={`Mapeo: ${values.map(v => Math.round(v)).join(', ')} mm`}>
        <defs>
            <linearGradient id="lm-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3dccb"/><stop offset="1" stopColor="#e9c9b3"/></linearGradient>
        </defs>
        <rect width="600" height="360" fill="url(#lm-skin)"/>
        <g transform="translate(0,-25)">
        {/* Ceja y párpado cerrado */}
        <path d="M140 70 Q300 30 470 75" fill="none" stroke="#6b4a36" strokeWidth="12" strokeLinecap="round" opacity=".55"/>
        <path d="M150 140 Q300 120 450 140" fill="none" stroke="#c99f86" strokeWidth="3" opacity=".7"/>
        <path d="M150 145 Q300 200 450 145" fill="none" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round"/>
        {/* Parche de hidrogel */}
        <path d="M150 150 Q300 215 450 150 Q430 280 300 290 Q170 280 150 150 Z" fill="#fbf3e6" opacity=".9"/>
        {/* Líneas del mapeo */}
        {values.map((mm, i) => {
            const t = i / (values.length - 1);
            const reveal = Math.max(0, Math.min(1, (seconds - .3 - i * .45) / .5));
            if (reveal <= 0) return null;
            const p = along(t);
            // Abanico: las del lagrimal salen casi rectas, las externas se abren hacia afuera.
            const fan = .55 * (t - .3);
            let dx = p.nx + p.tx * fan, dy = p.ny + p.ty * fan;
            const n = Math.hypot(dx, dy); dx /= n; dy /= n;
            const length = mm * 5.6 * reveal;
            const tip = { x: p.x + dx * length, y: p.y + dy * length };
            const label = { x: tip.x + dx * 16, y: tip.y + dy * 16 };
            const strong = i === peak;
            return <g key={i} opacity={reveal}>
                <line x1={p.x} y1={p.y} x2={tip.x} y2={tip.y} stroke={strong ? '#d4a517' : '#b8902f'} strokeWidth={strong ? 5 : 3} strokeLinecap="round"/>
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="700" fill="#323130" stroke="#fff" strokeWidth="4" paintOrder="stroke">{Math.round(mm)}</text>
            </g>;
        })}
        <path d="M160 150 Q300 205 440 150" fill="none" stroke="#d4a517" strokeWidth="2" opacity=".5"/>
        </g>
    </svg>;
}

export default function LashMapTutorialDialog({ userOffset, onClose }: { userOffset: number; onClose: () => void }) {
    const id = useId(), dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
    const [seconds, setSeconds] = useState(0), [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const time = useRef(0);
    const list = chapters(userOffset);
    const chapter = list.reduce((found, c, i) => seconds >= c.start ? i : found, 0);
    const offset = offsetAt(seconds, userOffset);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        close.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus();
        };
    }, []);
    useEffect(() => {
        if (!playing) return;
        let raf = 0, last = performance.now();
        const tick = (now: number) => {
            time.current = Math.min(DURATION, time.current + Math.min((now - last) / 1000, .1));
            last = now;
            setSeconds(time.current);
            if (time.current >= DURATION) { setPlaying(false); return; }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing]);
    useEffect(() => {
        const pause = () => { if (document.hidden) setPlaying(false); };
        document.addEventListener('visibilitychange', pause);
        return () => document.removeEventListener('visibilitychange', pause);
    }, []);
    function seek(value: number) { time.current = value; setSeconds(value); }
    function playPause() {
        if (playing) setPlaying(false);
        else { if (time.current >= DURATION) seek(0); setPlaying(true); }
    }
    function keys(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    }
    const button = 'rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]';
    const shown = Math.round(offset);
    return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={keys} onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-[900px] flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-[#9F8351] bg-[#094732] px-5 py-3.5 text-white"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">Tutorial visual</p><h2 id={id} className="mt-1 text-lg font-semibold leading-tight">Ajuste del mapeo para la técnica</h2></div><button ref={close} type="button" className="shrink-0 rounded-sm p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8c7a4]" aria-label="Cerrar ayuda" onClick={onClose}><X size={18}/></button></header>
            <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
                <div className="relative overflow-hidden rounded-sm border border-[#dce5df]">
                    <Stage seconds={seconds} offset={offset}/>
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap justify-between gap-2 p-3"><span className="rounded-sm border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-[#094732]">Cat Eye · {list[chapter].label}</span><span className="rounded-sm border border-white/80 bg-white/90 px-3 py-1 text-xs text-[#323130]">Ajuste: <output aria-label="Ajuste mostrado">{shown > 0 ? '+' : ''}{shown} mm</output></span></div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/85 to-transparent px-4 pb-4 pt-9 text-center"><p className="text-base font-semibold text-[#094732] sm:text-xl">{list[chapter].caption}</p></div>
                </div>
                <div className="mt-3 flex items-center gap-2 sm:gap-3"><button type="button" className={`${button} shrink-0`} aria-label={playing ? 'Pausar tutorial' : 'Reproducir tutorial'} onClick={playPause}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button><button type="button" className={`${button} shrink-0`} aria-label="Repetir tutorial" onClick={() => { seek(0); setPlaying(true); }}><RotateCcw size={17}/></button><input aria-label="Progreso del tutorial" type="range" min={0} max={DURATION} step={.1} value={seconds} onChange={e => seek(Number(e.target.value))} className="min-w-0 flex-1 accent-[#094732]"/><output aria-label="Tiempo del tutorial" className="shrink-0 text-xs tabular-nums text-[#605e5c]">{timestamp(seconds)} / {timestamp(DURATION)}</output></div>
                <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Partes del tutorial">{list.map((c, i) => <button type="button" key={c.label} className={`${button} ${chapter === i ? '!border-[#094732] !bg-[#eaf4ef]' : ''}`} aria-pressed={chapter === i} onClick={() => seek(c.start + (i === 0 ? 0 : 2.5))}>{c.label}</button>)}</div>
                <details className="mt-3 border-t border-[#edebe9] pt-3 text-xs text-[#605e5c]"><summary className="cursor-pointer text-[#094732]">Más detalles</summary>
                    <p className="mt-2">El mapeo es lo que el asistente (botón robot) dibuja sobre el parche: el largo en mm que va en cada zona, del lagrimal al extremo. Cada estilo lo define para el largo Medio.</p>
                    <p className="mt-2">El ajuste de cada largo suma o resta los mismos mm a todas las zonas. Solo cambia esos números: cómo se ven las pestañas 3D lo define la escala del largo.</p>
                    <p className="mt-2">Sin ajuste propio, sale de la escala: 0.78 → −2 mm, 1.23 → +2 mm.</p>
                </details>
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#edebe9] bg-[#f6f8f6] px-4 py-3"><p className="text-xs text-[#605e5c]">La demostración no modifica tu configuración.</p><button type="button" className="rounded-sm bg-[#094732] px-4 py-2 text-sm text-white hover:bg-[#0d5b40]" onClick={onClose}>Entendido</button></footer>
        </div>
    </div>, document.body);
}
