import type { RenderProfile } from '@/core/services/tryon/tryon.service';
export type StyleHelpKey = 'curl' | 'fan' | 'sweep' | 'spike_every' | 'spike_multiplier' | 'width_multiplier' | 'fan_spread' | 'mega_fan_spread' | 'roots_0' | 'roots_1' | 'roots_2' | 'roots_3';
export interface StyleHelpTopic {
    key: StyleHelpKey;
    title: string;
    description: string;
    less: string;
    more: string;
    tip: string;
    min: number;
    max: number;
    step: number;
    low: number;
    high: number;
    technique: number;
    view: 'front' | 'profile';
}
export const styleHelpTopics: StyleHelpTopic[] = [
    { key: 'curl', title: 'Curvatura', description: 'Controla cuánto se curva la fibra hacia fuera del párpado. Se aprecia mejor mirando la pestaña de perfil.', less: 'La fibra queda más recta.', more: 'La fibra forma una curva más marcada.', tip: 'No cambia el largo ni añade pelos. Compara de perfil y ajusta poco a poco.', min: 0, max: 1.2, step: .02, low: .2, high: 1, technique: 0, view: 'profile' },
    { key: 'fan', title: 'Apertura del abanico', description: 'Distribuye la dirección de las fibras a lo largo de toda la tira de pestañas.', less: 'Las fibras apuntan en direcciones más parecidas.', more: 'Las fibras se abren más hacia los lados de la tira.', tip: 'Es la apertura general del diseño. La apertura dentro de cada grupo se configura en Volumen y Megavolumen.', min: 0, max: 35, step: 1, low: 3, high: 30, technique: 0, view: 'front' },
    { key: 'sweep', title: 'Barrido hacia la sien', description: 'Inclina progresivamente las fibras de la zona exterior hacia la sien para acentuar una forma alargada.', less: 'La esquina exterior tiene menos inclinación hacia la sien.', more: 'La esquina exterior se peina más hacia la sien.', tip: '0 elimina el barrido añadido. Los valores negativos lo inclinan en el sentido contrario.', min: -40, max: 40, step: 1, low: 0, high: 35, technique: 0, view: 'front' },
    { key: 'spike_every', title: 'Pico cada N grupos', description: 'Intercala grupos destacados para crear un acabado con picos, como Wispy. N indica cada cuántos grupos aparece uno.', less: 'Con 2 aparece un pico cada dos grupos: son más frecuentes.', more: 'Con 8 aparece un pico cada ocho grupos: quedan más separados.', tip: '0 desactiva los picos. Para distinguirlos, este ejemplo usa una altura de pico de 1.6.', min: 0, max: 16, step: 1, low: 2, high: 8, technique: 0, view: 'front' },
    { key: 'spike_multiplier', title: 'Altura relativa del pico', description: 'Indica cuánto miden las fibras destacadas en comparación con las otras de su zona.', less: 'Por debajo de 1, el grupo destacado queda más corto que sus vecinos.', more: 'Por encima de 1, sobresale. Por ejemplo, 1.6 equivale a 1.6 veces el largo de su zona.', tip: 'Solo se nota si hay picos activos. Este ejemplo coloca uno cada cuatro grupos; 1 iguala su largo al resto.', min: .5, max: 2.5, step: .05, low: .7, high: 1.9, technique: 0, view: 'front' },
    { key: 'width_multiplier', title: 'Presencia de las fibras', description: 'Refuerza o suaviza el ancho visual de las fibras de este estilo.', less: 'Las fibras se ven más finas y discretas.', more: 'Las fibras se ven más anchas y definidas.', tip: 'Es un ajuste visual del estilo, no un diámetro en milímetros. Se combina con el grosor elegido en el probador.', min: .4, max: 1.8, step: .05, low: .4, high: 1.8, technique: 0, view: 'front' },
    { key: 'fan_spread', title: 'Apertura en volumen', description: 'Separa las fibras que salen de un mismo grupo cuando se aplica la técnica Volumen.', less: 'Las fibras del grupo quedan juntas, como un haz cerrado.', more: 'Las fibras del grupo forman un abanico más abierto.', tip: 'La comparación usa Volumen para que se note. Una técnica personalizada con su propia apertura puede reemplazar este valor.', min: 0, max: 24, step: 1, low: 0, high: 22, technique: 1, view: 'front' },
    { key: 'mega_fan_spread', title: 'Apertura en megavolumen', description: 'Controla la separación de las fibras dentro de cada grupo de Megavolumen.', less: 'Cada grupo queda compacto y concentrado.', more: 'Cada grupo ocupa más ancho y se abre más.', tip: 'Abrir el grupo no añade fibras. La comparación usa Megavolumen; una técnica personalizada puede definir su propia apertura.', min: 0, max: 24, step: 1, low: 0, high: 24, technique: 2, view: 'front' },
    ...(['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'] as const).map((title, i) => ({ key: `roots_${i}` as StyleHelpKey, title: `Grupos en ${title}`, description: i === 0 ? 'Define cuántos puntos de nacimiento se distribuyen en la tira. En Clásica, cada punto lleva una fibra.' : i === 3 ? 'Define cuántos grupos se reparten en la tira. Híbrida alterna fibras individuales y grupos de varias fibras.' : 'Define cuántos grupos se reparten a lo largo de la tira. Cada grupo contiene varias fibras.', less: 'Hay menos grupos: quedan más espacios y el acabado es más ligero.', more: 'Hay más grupos: la tira se ve más poblada.', tip: 'No es el número total de pelos. El total depende de la técnica; el sistema limita las fibras para conservar la fluidez. Las técnicas nuevas toman una de estas distribuciones como base.', min: 8, max: [120, 80, 40, 120][i], step: 1, low: [24, 16, 12, 16][i], high: [104, 72, 40, 104][i], technique: i, view: 'front' as const }))
];
export function styleHelpTopic(key: StyleHelpKey) { return styleHelpTopics.find(t => t.key === key)!; }
export function helpValue(profile: RenderProfile, key: StyleHelpKey): number { return key.startsWith('roots_') ? profile.roots[Number(key.slice(-1))] : profile[key as keyof Omit<RenderProfile, 'roots' | 'length_profile'>]; }
export function helpProfile(source: RenderProfile, key: StyleHelpKey, value: number): RenderProfile {
    const profile: RenderProfile = { ...source, roots: [...source.roots], length_profile: source.length_profile.map(p => ({ ...p })) };
    if (key.startsWith('roots_'))
        profile.roots[Number(key.slice(-1))] = value;
    else
        Object.assign(profile, { [key]: value });
    if (key === 'spike_every') {
        profile.spike_multiplier = 1.6;
        profile.spike_offset = value ? Math.min(profile.spike_offset, value - 1) : 0;
    }
    if (key === 'spike_multiplier') {
        profile.spike_every = 4;
        profile.spike_offset = Math.min(profile.spike_offset, 3);
    }
    return profile;
}
