import { useId } from 'react';
import type { ReactNode } from 'react';
export default function AdjustmentSlider({ label, value, min, max, step = 1, onChange, help }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    help?: ReactNode;
}) {
    const id = useId(), format = (n: number) => String(Number(n.toFixed(6)));
    return <div className="min-w-0 text-xs text-[#605e5c]"><div className="flex min-h-7 items-center justify-between gap-2"><label htmlFor={id} className="min-w-0">{label}</label><div className="flex shrink-0 items-center gap-1"><output htmlFor={id} className="rounded-sm bg-[#eaf4ef] px-2 py-1 font-semibold tabular-nums text-[#094732]">{format(value)}</output>{help}</div></div><input id={id} type="range" min={min} max={max} step={step} value={value} className="mt-2 block h-5 w-full cursor-pointer accent-[#094732] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#094732]" onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n))
        onChange(Number(Math.max(min, Math.min(max, min + Math.round((n - min) / step) * step)).toFixed(6))); }}/><div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#7b827d]" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}</span></div></div>;
}
