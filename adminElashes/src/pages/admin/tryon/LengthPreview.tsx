const MM_PER_SCALE = 12;
/** Largo en mm que representa una escala guardada (Medio = 1 = 12 mm). */
export const mmFromScale = (scale: number | null | undefined) => Number(((Number.isFinite(scale) ? scale! : 1) * MM_PER_SCALE).toFixed(1));
export const scaleFromMm = (mm: number) => Number((mm / MM_PER_SCALE).toFixed(4));
const PX_PER_MM = 5.5, BASE = 100, RULER_MM = 16;
/**
 * Muestra del largo: tres fibras idénticas (mismo grosor, curva, separación y
 * punto de inicio) que solo cambian de longitud según la escala guardada, junto
 * a una regla fija. Escala visual común a todas las opciones. El largo en mm se
 * muestra siempre.
 */
export function LengthSample({ scale }: { scale: number }) {
    const mm = mmFromScale(scale), h = Math.max(14, Math.min(92, mm * PX_PER_MM));
    const fibers = [38, 60, 82].map(x => {
        const w = 4.2, tx = x + h * .36, ty = BASE - h, cx = x + h * .03, cy = BASE - h * .6;
        return { x, d: `M${x - w / 2} ${BASE} Q${(cx - w * .15).toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q${(cx + w * .15).toFixed(1)} ${cy.toFixed(1)} ${x + w / 2} ${BASE}Z` };
    });
    const rx = 142, top = BASE - RULER_MM * PX_PER_MM, mark = BASE - Math.min(RULER_MM, mm) * PX_PER_MM;
    return <svg viewBox="0 0 200 120" className="block h-full w-full" role="img" aria-label={`Largo de ${mm} mm`}>
        <defs><linearGradient id="lenFiber" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#14100d"/><stop offset=".75" stopColor="#241d18"/><stop offset="1" stopColor="#5a4c42"/></linearGradient></defs>
        <line x1="24" y1={BASE} x2="118" y2={BASE} stroke="#cdbfb2" strokeWidth=".8"/>
        {fibers.map(f => <path key={f.x} d={f.d} fill="url(#lenFiber)"/>)}
        <line x1={rx} y1={top} x2={rx} y2={BASE} stroke="#b9ab9e" strokeWidth=".8"/>
        {Array.from({ length: RULER_MM + 1 }, (_, i) => <line key={i} x1={rx} y1={BASE - i * PX_PER_MM} x2={rx + (i % 5 === 0 ? 5 : 3)} y2={BASE - i * PX_PER_MM} stroke="#b9ab9e" strokeWidth=".7"/>)}
        <><line x1={rx - 4} y1={mark} x2={rx + 7} y2={mark} stroke="#9F8351" strokeWidth="1.6" strokeLinecap="round"/><text x={rx + 11} y={mark + 4} fontSize="11" fontWeight="600" fill="#6f5a33">{`${mm} mm`}</text></>
    </svg>;
}
export default function LengthPreview({ scale }: { scale: number }) {
    return <div className="rounded-sm border border-[#edebe9] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]">Largo de la fibra</p>
        <div className="overflow-hidden rounded-sm bg-[#fbf5ee]" style={{ aspectRatio: '5 / 3' }}><LengthSample scale={scale}/></div>
        <p className="mt-2 text-[11px] leading-snug text-[#605e5c]">Las tres fibras son iguales; solo cambia su longitud, a escala fija y con la misma regla en todas las opciones.</p>
    </div>;
}
