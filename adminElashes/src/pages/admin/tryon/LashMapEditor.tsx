import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { RenderProfile } from '../../../core/services/tryon/tryon.service';
import { BrandSwitch, footerButton } from './tryonUi';
import { MAP_MAX_ZONES, MAP_MIN_ZONES, MAP_VALUE_MAX, MAP_VALUE_MIN, computeLashMap } from './lashMap';

/**
 * Mapeo que el asistente (botón robot) dibuja sobre el parche de la clienta.
 * Sin mapeo propio, la app lo calcula desde la forma del estilo.
 */
export default function LashMapEditor({ value, profile, reference, onChange }: {
    value: number[] | null | undefined;
    profile: RenderProfile;
    /** Patrón validado que usa la app cuando no hay mapeo propio. */
    reference?: number[];
    onChange: (value: number[] | null) => void;
}) {
    const custom = Array.isArray(value) && value.length >= MAP_MIN_ZONES;
    const map = custom ? value : reference ?? computeLashMap(profile);
    const top = Math.max(...map, 1);
    const set = (i: number, mm: number) => onChange(map.map((v, j) => j === i ? mm : v));
    const resize = (zones: number) => onChange(computeLashMap(profile, zones).map((calc, i) => map[i] ?? calc));
    return <div className="space-y-4">
        <BrandSwitch checked={custom} onChange={on => onChange(on ? [...map] : null)} label="Usar el mapeo del salón" hint={custom ? 'El asistente usa estos números. Con otro largo, se suben o bajan todos por igual.' : reference ? 'Apagado: el asistente usa el patrón validado de este estilo, como se ve abajo.' : 'Apagado: el asistente lo calcula desde la forma del estilo, como se ve abajo.'}/>
        <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 pb-3 pt-4">
            <div className="flex items-end gap-2">
                {map.map((mm, i) => <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-24 w-full items-end justify-center">
                        <div className={`w-full max-w-[28px] rounded-t-sm ${custom ? 'bg-[#094732]' : 'bg-[#9F8351]/70'}`} style={{ height: `${Math.max(12, (mm / top) * 100)}%` }} aria-hidden="true"/>
                    </div>
                    {custom
                        ? <input type="number" aria-label={`Zona ${i + 1} en mm`} className="w-full max-w-[52px] rounded-sm border border-[#c8c6c4] bg-white px-1 py-1 text-center text-sm font-semibold tabular-nums text-[#323130] focus:border-[#094732] focus:outline-none" min={MAP_VALUE_MIN} max={MAP_VALUE_MAX} step={1} value={mm} onChange={e => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n)) set(i, Math.max(MAP_VALUE_MIN, Math.min(MAP_VALUE_MAX, n))); }}/>
                        : <span className="text-sm font-semibold tabular-nums text-[#7a6338]">{mm}</span>}
                </div>)}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8a8886]"><span>Lagrimal</span><span>Extremo</span></div>
        </div>
        <p className="text-xs text-[#605e5c]">Números en mm para el largo <b>Medio</b>. El ajuste de cada largo se define en Gestionar largos.</p>
        {custom && <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${footerButton.ghost} !px-2`} disabled={map.length <= MAP_MIN_ZONES} onClick={() => resize(map.length - 1)}><Minus size={14}/>Quitar zona</button>
            <button type="button" className={`${footerButton.ghost} !px-2`} disabled={map.length >= MAP_MAX_ZONES} onClick={() => resize(map.length + 1)}><Plus size={14}/>Agregar zona</button>
            <button type="button" className={`${footerButton.ghost} !px-2 text-[#094732]`} onClick={() => onChange(computeLashMap(profile, map.length))}><RotateCcw size={14}/>Calcular desde la forma</button>
        </div>}
    </div>;
}

