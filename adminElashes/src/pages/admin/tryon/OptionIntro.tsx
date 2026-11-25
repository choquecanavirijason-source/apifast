import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/common/ui';
import type { OptionKind } from '@/core/services/tryon/tryon.service';
import SectionTutorialDialog, { StylesTutorialDialog } from './SectionTutorial';

/** Qué es cada apartado, en pocas palabras. */
const summaries: Record<OptionKind, string> = {
    technique: 'La técnica define cómo se arma cada punto de aplicación: cuántas fibras salen de él y cómo se abren (una sola, abanico, en Y…). No es el estilo: se combina con él.',
    length: 'El largo define cuánto miden las pestañas, en milímetros. La clienta elige entre los largos que dejes disponibles.',
    thickness: 'El grosor define qué tan gruesa es cada fibra, en milímetros. Se combina con el estilo y la técnica.',
    color: 'El color define el tono de las pestañas que puede probar la clienta (negro, café, azul…).',
    curl: 'La curvatura define cómo se curva la fibra desde la base hasta la punta (recta, J, C, D…).',
};

const stylesSummary = 'Un estilo es el diseño completo de la mirada: dónde va el largo, cuánto se curva y se abre. La clienta lo elige y lo combina con largo, técnica, grosor y color.';

/** Qué trata el apartado, en una frase: va como subtítulo de la página. */
export const summaryFor = (kind?: OptionKind) => kind ? summaries[kind] : stylesSummary;

/** Botón «Ver cómo funciona»: abre el tutorial animado del apartado (sin `kind`, el de Estilos y efectos). */
export function TutorialButton({ kind }: { kind?: OptionKind }) {
    const [open, setOpen] = useState(false);
    return <>
        <Button variant="ghost" size="sm" leftIcon={<CircleHelp size={14}/>} onClick={() => setOpen(true)}>Ver cómo funciona</Button>
        {open && (kind ? <SectionTutorialDialog kind={kind} onClose={() => setOpen(false)}/> : <StylesTutorialDialog onClose={() => setOpen(false)}/>)}
    </>;
}
