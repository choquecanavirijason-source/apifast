/**
 * Muestra del grosor: tres fibras curvas con raíz y punta afinada, y una lupa
 * con el corte de la fibra. Todo en escala absoluta (no depende de las demás
 * opciones), así que dos grosores se pueden comparar a simple vista.
 */
export function ThicknessSample({ diameter }: { diameter: number }) {
    const d = Number.isFinite(diameter) ? Math.max(.02, Math.min(.3, diameter)) : .07;
    const w = Math.max(1.6, d * 38), dot = Math.max(1.6, d * 55), base = 98;
    const fibers = [58, 80, 102].map((x, i) => {
        const tx = x + 36 - i * 2, ty = base - 88 + i * 6, cx = x + 3, cy = base - 52;
        return { x, d: `M${(x - w / 2).toFixed(1)} ${base} Q${(cx - w * .15).toFixed(1)} ${cy} ${tx} ${ty} Q${(cx + w * .15).toFixed(1)} ${cy} ${(x + w / 2).toFixed(1)} ${base}Z`, tip: [tx, ty] as const };
    });
    return <svg viewBox="0 0 200 120" className="block h-full w-full" role="img" aria-label={`Fibra de ${d} mm`}>
        <defs>
            <linearGradient id="thickFiber" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#14100d"/><stop offset=".7" stopColor="#241d18"/><stop offset="1" stopColor="#5a4c42"/></linearGradient>
            <filter id="thickBlur" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <ellipse cx="84" cy={base + 2} rx="62" ry="3" fill="#6b4a32" opacity=".2" filter="url(#thickBlur)"/>
        {fibers.map(f => <path key={f.x} d={f.d} fill="url(#thickFiber)"/>)}
        <line x1="116" y1="62" x2="143" y2="62" stroke="#c8b6a4" strokeWidth=".8"/>
        <circle cx="162" cy="62" r="22" fill="#fff" fillOpacity=".55" stroke="#cdb9a6" strokeWidth="1"/>
        <circle cx="162" cy="62" r={dot} fill="#1b1b1b"/>
    </svg>;
}
export default function ThicknessPreview({ diameter }: { diameter: number }) {
    return <div className="rounded-sm border border-[#edebe9] bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#094732]">Grosor de la fibra</p>
        <div className="relative overflow-hidden rounded-sm bg-gradient-to-br from-[#fdf8f1] to-[#f1e4d5]" style={{ aspectRatio: '5 / 3' }}>
            <ThicknessSample diameter={diameter}/>
            <span className="absolute bottom-2 right-3 text-lg font-semibold tabular-nums text-[#9F8351]">{Number.isFinite(diameter) ? `${Number(diameter.toFixed(3))} mm` : ''}</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[#605e5c]">Las fibras y el círculo se dibujan a escala fija: el círculo muestra el corte de la fibra, y crece con el diámetro.</p>
    </div>;
}
