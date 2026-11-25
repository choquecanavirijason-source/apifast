import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';

/**
 * Confirmación para eliminar una opción del catálogo. Si ya se publicó, avisa
 * de lo que implica y exige aceptarlo antes de poder eliminar.
 */
export default function DeleteOptionDialog({ name, published, busy, onConfirm, onCancel }: { name: string; published: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
    const [accepted, setAccepted] = useState(false);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);
    const canDelete = !busy && (!published || accepted);
    return createPortal(<div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#021a12]/60 p-3 backdrop-blur-[2px]" onClick={() => { if (!busy) onCancel(); }}>
        <div role="alertdialog" aria-modal="true" aria-label="Eliminar opción" onClick={e => e.stopPropagation()} className="w-full max-w-[460px] overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
            <div className="px-5 pb-4 pt-5">
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#323130]"><Trash2 size={18} className="text-red-700"/>Eliminar «{name}»</h2>
                {published ? <>
                    <p className="mt-3 text-sm text-[#605e5c]">Esta opción ya se publicó. Al eliminarla:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#605e5c]">
                        <li>Deja de ofrecerse en el probador y desaparece de esta lista.</li>
                        <li>No se puede recuperar desde el admin.</li>
                        <li>Se quita sola de los estilos que la ofrecen. Si algún estilo no tendría otra opción de este tipo, no se elimina.</li>
                    </ul>
                    <div className="mt-4 flex gap-2 rounded-sm border border-[#e8c9a0] bg-[#fdf6ea] p-3 text-xs text-[#7a5a1c]"><AlertTriangle size={16} className="mt-px shrink-0"/><span>Si solo quieres dejar de ofrecerla, es más seguro apagar «Disponible al publicar» y publicar: así se puede volver a activar.</span></div>
                    <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-[#323130]"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b42318]" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>Entiendo que se eliminará y no se podrá deshacer.</label>
                </> : <p className="mt-3 text-sm text-[#605e5c]">Es un borrador que nunca se publicó, así que no afecta al probador. Esta acción no se puede deshacer.</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edebe9] bg-[#f6f8f6] px-4 py-3">
                <button type="button" className="rounded-sm border border-[#d8d5d2] bg-white px-3 py-1.5 text-sm hover:bg-[#f3f2f1] disabled:opacity-50" onClick={onCancel} disabled={busy}>Cancelar</button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-sm bg-[#b42318] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#912018] disabled:cursor-not-allowed disabled:opacity-50" onClick={onConfirm} disabled={!canDelete}><Trash2 size={14}/>{busy ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
        </div>
    </div>, document.body);
}
