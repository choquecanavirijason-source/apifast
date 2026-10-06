import { useState } from "react";
import { Lightbulb, MousePointer2, MousePointerClick, Move, MoveVertical, PencilLine, X } from "lucide-react";

const STORAGE_KEY = "agenda-hints-dismissed";

const HINTS = [
  { icon: MousePointerClick, text: "Clic en un espacio libre para crear una reserva" },
  { icon: Move, text: "Arrastra una reserva para cambiarla de hora o de día" },
  { icon: MoveVertical, text: "Estira desde el borde de arriba o de abajo para cambiar la duración" },
  { icon: PencilLine, text: "Doble clic en una reserva para editarla" },
  { icon: MousePointer2, text: "Clic derecho para pasarla a En servicio, finalizarla o pasarla a venta" },
];

/** Barra de ayuda de la agenda: explica en una línea cómo se usa. Se puede cerrar y no vuelve a aparecer. */
export default function AgendaHintsBar() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-accent-soft)] px-3 py-2">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9F8351]" aria-hidden />
      <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
        {HINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5 text-[11px] text-[var(--ui-text)]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--ui-accent)]" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
        aria-label="Ocultar consejos"
        title="Entendido, ocultar"
        className="shrink-0 rounded-md p-0.5 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
