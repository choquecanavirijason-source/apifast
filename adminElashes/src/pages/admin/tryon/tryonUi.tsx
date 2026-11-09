import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Piezas visuales compartidas por los modales del catálogo de pestañas
 * (estilos, largos, técnicas y grosores). Usan los colores de la marca
 * (verde #094732, dorado #9F8351) y las reglas Business Central del admin:
 * radios pequeños, sin degradados ni sombras exageradas.
 */

export const fieldInput =
    'w-full rounded-sm border border-[#d8d5d2] bg-white px-3 py-2 text-sm text-[#323130] shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] transition-colors placeholder:text-[#a19f9d] hover:border-[#bdb9b5] focus:border-[#094732] focus:outline-none focus:ring-2 focus:ring-[#094732]/15 disabled:bg-[#f8f7f6] disabled:text-[#8a8886]';

export const fieldLabel = 'block text-xs font-semibold text-[#605e5c]';

/** Botones del pie de los editores. */
export const footerButton = {
    ghost: 'inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-[#323130] transition-colors hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-50',
    outline: 'inline-flex items-center gap-2 rounded-sm border border-[#9F8351] bg-white px-4 py-2 text-sm font-semibold text-[#7a6338] transition-colors hover:bg-[#9F8351]/10 disabled:cursor-not-allowed disabled:border-[#d8d5d2] disabled:text-[#a19f9d] disabled:hover:bg-white',
    primary: 'inline-flex items-center gap-2 rounded-sm bg-[#094732] px-5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(2,26,18,0.25)] transition-colors hover:bg-[#063324] disabled:cursor-not-allowed disabled:bg-[#c8d3cd] disabled:shadow-none',
};

export type StatusTone = 'draft' | 'pending' | 'published' | 'inactive';

/** Tono de estado a partir del texto que ya calculan las páginas. */
export function statusTone(label: string): StatusTone {
    if (label === 'Publicado') return 'published';
    if (label === 'Desactivado') return 'inactive';
    if (label === 'Cambios sin publicar') return 'pending';
    return 'draft';
}

const toneClass: Record<StatusTone, { chip: string; dot: string }> = {
    draft: { chip: 'border-[#e3d6bd] bg-[#faf6ee] text-[#7a6338]', dot: 'bg-[#9F8351]' },
    pending: { chip: 'border-[#f0d9a8] bg-[#fdf6e7] text-[#8a5a00]', dot: 'bg-[#d08b00]' },
    published: { chip: 'border-[#c6ddd1] bg-[#eef6f1] text-[#094732]', dot: 'bg-[#1c8a5a]' },
    inactive: { chip: 'border-[#e1dfdd] bg-[#f3f2f1] text-[#605e5c]', dot: 'bg-[#a19f9d]' },
};

export function StatusBadge({ label, tone = statusTone(label), onDark = false }: { label: string; tone?: StatusTone; onDark?: boolean }) {
    const cls = toneClass[tone];
    return <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${onDark ? 'border-white/25 bg-white/10 text-white' : cls.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} aria-hidden="true"/>{label}
    </span>;
}

/**
 * Ventana de edición del catálogo. Se dibuja en línea (no en un portal),
 * igual que `GenericModal`, para que los `ConfirmDialog` que la página
 * renderiza después queden por encima.
 */
export function TryOnModal({ isOpen, onClose, eyebrow, title, status, children, footer, maxWidth = 'max-w-[1120px]', bodyClassName = '' }: {
    isOpen: boolean;
    onClose: () => void;
    eyebrow: string;
    title: string;
    status?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: string;
    /** Clases extra para el cuerpo (p. ej. columnas con scroll propio). */
    bodyClassName?: string;
}) {
    const titleId = useId();
    const closeButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButton.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            if (previous?.isConnected) previous.focus();
        };
    }, [isOpen]);
    if (!isOpen) return null;
    function keys(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    }
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#021a12]/45 p-3 backdrop-blur-[2px]" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keys} className={`flex max-h-[90dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-sm border border-black/10 bg-[#f3f2f1] shadow-[0_18px_48px_rgba(2,26,18,0.28)]`}>
            <header className="shrink-0 border-b-2 border-[#9F8351] bg-[#094732] px-5 py-3.5 text-white sm:px-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8c7a4]">{eyebrow}</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold leading-tight">{title}</h2>
                            {status}
                        </div>
                    </div>
                    <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-sm p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8c7a4]">
                        <X size={18}/>
                    </button>
                </div>
            </header>
            <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 ${bodyClassName}`}>{children}</div>
            {footer && <footer className="shrink-0 border-t border-[#e1dfdd] bg-white px-4 py-3 sm:px-6">{footer}</footer>}
        </div>
    </div>;
}

/** Pestañas del editor (FastTabs): subrayado dorado en la activa. */
export function EditorTabs<K extends string>({ tabs, active, onChange, label }: {
    tabs: ReadonlyArray<{ key: K; name: string; icon?: ReactNode }>;
    active: K;
    onChange: (key: K) => void;
    label: string;
}) {
    return <nav className="mb-5 flex flex-nowrap gap-x-1 overflow-x-auto border-b border-[#e1dfdd] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={label}>
        {tabs.map(tab => {
            const selected = tab.key === active;
            return <button key={tab.key} type="button" aria-pressed={selected} onClick={() => onChange(tab.key)}
                className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#094732] ${selected ? 'border-[#9F8351] font-semibold text-[#094732]' : 'border-transparent text-[#605e5c] hover:border-[#d8d5d2] hover:text-[#323130]'}`}>
                {tab.icon && <span className={selected ? 'text-[#9F8351]' : 'text-[#8a8886]'} aria-hidden="true">{tab.icon}</span>}
                {tab.name}
            </button>;
        })}
    </nav>;
}

/** Tarjeta de sección dentro de un editor. */
export function EditorSection({ title, description, icon, action, children, className = '', bodyClassName = 'p-5' }: {
    title: string;
    description?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return <section className={`overflow-hidden rounded-sm border border-[#e1dfdd] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[#edebe9] bg-[#faf9f8] px-5 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
                {icon ? <span className="mt-0.5 text-[#9F8351]" aria-hidden="true">{icon}</span> : <span className="mt-1 h-3.5 w-0.5 shrink-0 bg-[#9F8351]" aria-hidden="true"/>}
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#323130]">{title}</h3>
                    {description && <p className="mt-0.5 text-xs leading-relaxed text-[#605e5c]">{description}</p>}
                </div>
            </div>
            {action}
        </header>
        <div className={bodyClassName}>{children}</div>
    </section>;
}

/** Interruptor accesible con los colores de la marca. */
export function BrandSwitch({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
    const id = useId();
    return <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-sm border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2.5 transition-colors hover:border-[#bdb9b5]">
        <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0">
            {/* Casilla real (transparente) encima del interruptor: conserva el rol de casilla y recibe el clic. */}
            <input id={id} type="checkbox" className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" checked={checked} onChange={e => onChange(e.target.checked)}/>
            <span className="h-5 w-9 rounded-full bg-[#c8c6c4] transition-colors peer-checked:bg-[#094732] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#094732] peer-disabled:opacity-50"/>
            <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"/>
        </span>
        <span className="min-w-0">
            <span className="block text-sm font-medium text-[#323130]">{label}</span>
            {hint && <span className="mt-0.5 block text-xs text-[#605e5c]">{hint}</span>}
        </span>
    </label>;
}

/** Casilla tipo «chip» con muestra de color, para los colores de pestaña. */
export function ColorChip({ checked, onChange, label, color }: { checked: boolean; onChange: () => void; label: string; color: string }) {
    return <label className={`relative inline-flex cursor-pointer select-none items-center gap-2 rounded-sm border py-1.5 pl-2 pr-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#094732] ${checked ? 'border-[#094732] bg-[#eef6f1] font-medium text-[#094732]' : 'border-[#d8d5d2] bg-white text-[#323130] hover:border-[#9F8351]'}`}>
        <input type="checkbox" className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" checked={checked} onChange={onChange}/>
        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? 'border-[#094732] ring-2 ring-[#094732]/20' : 'border-black/15'}`} style={{ backgroundColor: color }} aria-hidden="true">
            {checked && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white drop-shadow"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </span>
        {label}
    </label>;
}

/** Casilla tipo «chip» para elegir opciones (largos, técnicas, grosores). */
export function OptionChip({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
    return <label className={`relative inline-flex cursor-pointer select-none items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#094732] ${checked ? 'border-[#094732] bg-[#eef6f1] font-medium text-[#094732]' : 'border-[#d8d5d2] bg-white text-[#323130] hover:border-[#9F8351]'}`}>
        <input type="checkbox" className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0" checked={checked} onChange={onChange}/>
        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-[2px] border ${checked ? 'border-[#094732] bg-[#094732]' : 'border-[#a19f9d] bg-white'}`} aria-hidden="true">
            {checked && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </span>
        {label}
    </label>;
}
