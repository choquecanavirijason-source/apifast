import { useId, useState } from 'react';
import type { ReactNode } from 'react';
export default function AdjustmentSlider({ label, value, min, max, step = 1, onChange, help, ariaLabel }: {
    label: string;
    /** Nombre accesible distinto de la etiqueta visible (opcional). */
    ariaLabel?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    help?: ReactNode;
}) {
    // Decimales según el paso del control (0.005 → 3): evita mostrar valores
    // como 0.265766 que vienen de las plantillas sin redondear.
    const decimals = Math.min(6, (String(step).split('.')[1] ?? '').length);
    const id = useId(), format = (n: number) => String(Number(n.toFixed(decimals)));
    // Lleva el valor al rango y al paso del control.
    const snap = (n: number) => Number(Math.max(min, Math.min(max, min + Math.round((n - min) / step) * step)).toFixed(6));
    // Texto mientras se escribe (permite estados intermedios como "0." o "-");
    // `null` = no se está editando y se muestra el valor actual.
    const [typed, setTyped] = useState<string | null>(null);
    function commit() {
        if (typed === null) return;
        const n = Number(typed.replace(',', '.'));
        if (typed.trim() !== '' && Number.isFinite(n)) onChange(snap(n));
        setTyped(null);
    }
    return <div className="min-w-0 text-xs text-[#605e5c]"><div className="flex min-h-7 items-center justify-between gap-2"><label htmlFor={id} className="min-w-0">{label}</label><div className="flex shrink-0 items-center gap-1"><input type="text" inputMode="decimal" aria-label={`${ariaLabel ?? label}: escribir valor`} title={`Escribe un valor entre ${format(min)} y ${format(max)}`} className="w-16 rounded-sm border border-transparent bg-[#eaf4ef] px-2 py-1 text-right font-semibold tabular-nums text-[#094732] hover:border-[#b9d6c7] focus:border-[#094732] focus:bg-white focus:outline-none disabled:hover:border-transparent" value={typed ?? format(value)} onFocus={e => { setTyped(format(value)); e.currentTarget.select(); }} onChange={e => setTyped(e.target.value)} onBlur={commit} onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.stopPropagation(); setTyped(null); e.currentTarget.blur(); }
    }}/>{help}</div></div><input id={id} aria-label={ariaLabel} type="range" min={min} max={max} step={step} value={value} className="mt-2 block h-5 w-full cursor-pointer accent-[#094732] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#094732]" onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n))
        onChange(snap(n)); }}/><div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#7b827d]" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}</span></div></div>;
}
