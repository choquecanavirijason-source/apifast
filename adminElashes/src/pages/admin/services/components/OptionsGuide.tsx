import { Info } from "lucide-react";

export type GuideItem = { name: string; text: string };

/** Recuadro plegable que explica, en una línea, qué hace cada opción del formulario. */
export default function OptionsGuide({ title = "¿Qué significa cada opción?", items }: { title?: string; items: GuideItem[] }) {
  return (
    <details className="group rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-sky-900">
        <Info className="h-4 w-4 shrink-0" />
        {title}
        <span className="ml-auto text-[11px] font-medium text-sky-700 group-open:hidden">Ver</span>
        <span className="ml-auto hidden text-[11px] font-medium text-sky-700 group-open:inline">Ocultar</span>
      </summary>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
        {items.map((item) => (
          <li key={item.name}>
            <strong className="text-slate-900">{item.name}:</strong> {item.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

export const CATEGORY_GUIDE: GuideItem[] = [
  { name: "Nombre e imagen", text: "Cómo se llama la categoría (por ejemplo Pestañas o Cejas) y la foto que se muestra en las tarjetas." },
  { name: "Servicio móvil", text: "Actívalo si los servicios de esta categoría se hacen a domicilio, fuera del salón." },
  { name: "Tiene mantenimiento", text: "La clienta vuelve cada cierto tiempo para un retoque. Si lo activas, cada servicio de la categoría te pedirá cada cuántos días." },
  { name: "Tiene retiro", text: "El trabajo se retira después de un tiempo. Si lo activas, cada servicio te pedirá a los cuántos días." },
  { name: "Cuestionario de anamnesis", text: "Un cuestionario de salud/preferencias que se le muestra a la clienta al finalizar el servicio. \"Sin cuestionario\" no pregunta nada." },
];

export const SERVICE_GUIDE: GuideItem[] = [
  { name: "Categoría", text: "Grupo al que pertenece el servicio. Define si usa mantenimiento y retiro." },
  { name: "Duración", text: "Minutos que ocupa en la agenda; así se calcula el horario de la cita." },
  { name: "Retoque / mantenimiento y Retiro", text: "Días hasta que la clienta debe volver. Vacío significa que no aplica. Solo aparece si la categoría lo permite." },
  { name: "Precio", text: "Lo que se cobra en la caja por este servicio." },
  { name: "Comisión (%)", text: "Porcentaje que gana la operaria. Si lo dejas vacío se usa la tasa de la propia operaria." },
  { name: "Descuento / Promoción (%)", text: "Rebaja el precio un porcentaje mientras esté puesto. Vacío o 0 significa sin promoción." },
  { name: "Estado", text: "Activo aparece en la caja y la agenda; inactivo se oculta sin borrarlo." },
];
