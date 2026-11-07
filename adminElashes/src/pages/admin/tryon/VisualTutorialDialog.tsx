import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import Lash3DPreview from './Lash3DPreview';
import { tutorialDuration, tutorialFrame, tutorialCaptions } from './styleTutorialTimeline';
import type { VisualTutorialTopic, TutorialDemo } from './tutorialTypes';
const timestamp = (n: number) => `0:${Math.floor(n).toString().padStart(2, '0')}`;
export default function VisualTutorialDialog({ topic, currentValue, renderDemo, onClose, onPrevious, onNext, stepLabel }: {
    topic: VisualTutorialTopic;
    currentValue: number;
    renderDemo: (value: number) => TutorialDemo;
    onClose: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    stepLabel?: string;
}) {
    const id = useId(), dialog = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
    const [seconds, setSeconds] = useState(0), [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const time = useRef(0), frame = tutorialFrame(topic, seconds), captions = tutorialCaptions(topic);
    const demo = useMemo(() => renderDemo(frame.value), [renderDemo, frame.value]);
    const formatValue = topic.formatValue ?? ((value: number) => String(value));
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        close.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            if (previous?.isConnected)
                previous.focus();
        };
    }, []);
    useEffect(() => {
        if (!playing)
            return;
        let raf = 0, last = performance.now(), paint = last;
        const tick = (now: number) => {
            time.current = Math.min(tutorialDuration, time.current + Math.min((now - last) / 1000, .1));
            last = now;
            if (now - paint >= 1000 / 30 || time.current === tutorialDuration) {
                setSeconds(time.current);
                paint = now;
            }
            if (time.current >= tutorialDuration) {
                setPlaying(false);
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing]);
    useEffect(() => {
        const pause = () => {
            if (document.hidden)
                setPlaying(false);
        };
        document.addEventListener('visibilitychange', pause);
        return () => document.removeEventListener('visibilitychange', pause);
    }, []);
    function seek(value: number) { time.current = value; setSeconds(value); }
    function replay() { seek(0); setPlaying(true); }
    function playPause() {
        if (playing)
            setPlaying(false);
        else {
            if (time.current >= tutorialDuration)
                seek(0);
            setPlaying(true);
        }
    }
    function keys(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
        if (e.key === 'Tab') {
            const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,summary,[tabindex="0"]');
            if (!items?.length)
                return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    const button = 'rounded-sm border border-[#edebe9] bg-white px-3 py-2 text-sm hover:bg-[#f3f2f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#094732]';
    const caption = frame.phase === 'low' ? captions[0] : frame.phase === 'high' || frame.phase === 'finished' ? captions[1] : frame.phase === 'turning' ? 'Veámoslo desde otro ángulo' : 'Mira cómo cambia la pestaña';
    return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={onClose}>
  <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={keys} onClick={e => e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-[1100px] flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
   <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#edebe9] bg-[#f6f8f6] px-5 py-3"><div><p className="text-xs text-[#605e5c]">Tutorial visual{stepLabel ? ` · ${stepLabel}` : ''}</p><h2 id={id} className="mt-1 text-lg font-semibold">{topic.title}</h2></div><button ref={close} type="button" className={button} aria-label="Cerrar ayuda" onClick={onClose}><X size={18}/></button></header>
   <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
    <div className="relative overflow-hidden rounded-sm border border-[#dce5df]">
     <Lash3DPreview profile={demo.profile} selection={demo.selection} options={demo.options} cinematic camera={frame.camera} canExpand={false}/>
     <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap justify-between gap-2 p-3"><span className="rounded-sm border border-white/80 bg-white/90 px-3 py-1 text-xs font-medium text-[#094732]">{frame.view}</span><span className="rounded-sm border border-white/80 bg-white/90 px-3 py-1 text-xs text-[#323130]">Valor: <output aria-label="Valor mostrado">{formatValue(frame.value)}</output></span></div>
     <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/85 to-transparent px-4 pb-4 pt-9 text-center"><p className="text-base font-semibold text-[#094732] sm:text-xl">{caption}</p></div>
    </div>
    <div className="mt-3 flex items-center gap-2 sm:gap-3"><button type="button" className={`${button} shrink-0`} aria-label={playing ? 'Pausar tutorial' : 'Reproducir tutorial'} onClick={playPause}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button><button type="button" className={`${button} shrink-0`} aria-label="Repetir tutorial" onClick={replay}><RotateCcw size={17}/></button><input aria-label="Progreso del tutorial" type="range" min={0} max={tutorialDuration} step={.1} value={seconds} onChange={e => seek(Number(e.target.value))} className="min-w-0 flex-1 accent-[#094732]"/><output aria-label="Tiempo del tutorial" className="shrink-0 text-xs tabular-nums text-[#605e5c]">{timestamp(seconds)} / {timestamp(tutorialDuration)}</output></div>
    <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Ángulos del tutorial">{['Frente', 'Perfil', 'Desde arriba'].map((name, i) => { const order = topic.view === 'profile' ? [1, 0, 2] : [0, 1, 2]; const chapter = order.indexOf(i); return <button type="button" key={name} className={`${button} ${frame.chapter === chapter ? '!border-[#094732] !bg-[#eaf4ef]' : ''}`} aria-pressed={frame.chapter === chapter} onClick={() => seek(chapter * 8 + 1)}>{name}</button>; })}</div>
    <details className="mt-3 border-t border-[#edebe9] pt-3 text-xs text-[#605e5c]"><summary className="cursor-pointer text-[#094732]">Más detalles</summary><p className="mt-2">{topic.description}</p><p className="mt-2">{topic.tip}</p><p className="mt-2">{demo.note} Tu valor actual: {formatValue(currentValue)}.</p></details>
   </div>
   <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#edebe9] bg-[#f6f8f6] px-4 py-3"><p className="text-xs text-[#605e5c]">La demostración no modifica tu diseño.</p><div className="flex flex-wrap gap-2">{onPrevious && <button type="button" className={`${button} inline-flex items-center gap-1`} onClick={onPrevious}><ChevronLeft size={14}/>Anterior</button>}{onNext && <button type="button" className={`${button} inline-flex items-center gap-1`} onClick={onNext}>Siguiente<ChevronRight size={14}/></button>}<button type="button" className="rounded-sm bg-[#094732] px-4 py-2 text-sm text-white hover:bg-[#0d5b40]" onClick={onClose}>Entendido</button></div></footer>
  </div></div>, document.body);
}
