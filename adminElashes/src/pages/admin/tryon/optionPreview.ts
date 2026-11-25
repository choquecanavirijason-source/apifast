import type { OptionKind, OptionParameters, OptionGroups, RenderProfile, SalonOption } from '@/core/services/tryon/tryon.service';
import type { TutorialDemo, VisualTutorialTopic } from './tutorialTypes';
import { mmFromScale } from './LengthPreview';
const clamp = (n: number | null | undefined, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
export const optionDefaults: OptionParameters = { scale: null, diameter: null, base_technique: null, fibers_per_group: null, single_every: 0, density: 1, spread: null };
export function safeOptionParameters(kind: OptionKind, p: OptionParameters): OptionParameters {
    if (kind === 'length')
        return { ...optionDefaults, scale: clamp(p.scale, .4, 1.8, 1) };
    if (kind === 'thickness')
        return { ...optionDefaults, diameter: clamp(p.diameter, .03, .25, .07) };
    if (kind === 'color')
        return { ...optionDefaults, color: typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#111111', gloss: clamp(p.gloss ?? 0, 0, 1, 0) };
    return { ...optionDefaults, base_technique: Math.round(clamp(p.base_technique, 0, 3, 1)), fibers_per_group: p.fibers_per_group === null ? null : Math.round(clamp(p.fibers_per_group, 1, 8, 3)), single_every: Math.round(clamp(p.single_every, 0, 8, 0)), density: clamp(p.density, .25, 1.5, 1), spread: p.spread === null ? null : clamp(p.spread, 0, 24, 10), layer_split: clamp(p.layer_split ?? 0, 0, 40, 0), stem: clamp(p.stem ?? 0, 0, .6, 0), tip_merge: clamp(p.tip_merge ?? 0, 0, 1, 0), layer_curl: clamp(p.layer_curl ?? 0, -40, 40, 0) };
}
export function optionPreviewDemo(profile: RenderProfile, kind: OptionKind, parameters: OptionParameters, styleName: string): TutorialDemo {
    const option: SalonOption = { id: 4094, name: 'Vista de prueba', is_active: true, sort_order: 0, parameters: safeOptionParameters(kind, parameters) };
    const options: OptionGroups = { length: [], technique: [], thickness: [], color: [] };
    options[kind] = [{ option, published: { ...option, revision: 1 }, revision: 1, published_revision: 1 }];
    return { profile, options, selection: { length: kind === 'length' ? 4094 : 1, technique: kind === 'technique' ? 4094 : 0, thickness: kind === 'thickness' ? 4094 : 3, color: kind === 'color' ? 4094 : undefined }, note: `Ejemplo sobre ${styleName}.` };
}
export type OptionHelpKey = 'scale' | 'diameter' | 'base_technique' | 'original' | 'fibers_per_group' | 'single_every' | 'density' | 'spread' | 'layer_split' | 'stem' | 'tip_merge' | 'layer_curl';
const basic = { technique: 0, view: 'front' as const };
export const optionHelpTopics: Record<OptionHelpKey, VisualTutorialTopic> = {
    scale: { ...basic, key: 'option_scale', title: 'Largo de las pestañas', description: 'Cambia cuánto miden las pestañas, en milímetros, sin cambiar la forma del estilo ni su raíz.', less: 'Más corto.', more: 'Más largo.', tip: 'El ejemplo va de unos 8 mm a unos 18 mm. Medio equivale a 12 mm. Las fibras crecen desde la misma raíz y el estilo conserva su forma; el largo real final lo define el mapeo de la técnica.', min: .4, max: 1.8, step: .01, low: .65, high: 1.5, captions: ['Más cortas', 'Más largas'], formatValue: v => `${mmFromScale(v)} mm` },
    diameter: { ...basic, key: 'option_diameter', title: 'Grosor de las fibras', description: 'Cambia el ancho visual de cada fibra usando el diámetro nominal.', less: 'Más fino.', more: 'Más grueso.', tip: 'No añade fibras ni aumenta su largo. Es una simulación visual del diámetro, no una medición del resultado real.', min: .03, max: .25, step: .005, low: .05, high: .15, captions: ['Fibras más finas', 'Fibras más gruesas'], formatValue: v => `${v.toFixed(3)} mm` },
    base_technique: { ...basic, key: 'option_base', title: 'Distribución base', description: 'Elige el patrón de grupos del estilo sobre el que se construye la técnica.', less: 'Clásica.', more: 'Megavolumen.', tip: 'El ejemplo recorre Clásica, Volumen y Megavolumen con su distribución original.', min: 0, max: 3, step: 1, low: 0, high: 2, captions: ['Fibras individuales', 'Grupos con más fibras'], formatValue: v => ['Clásica', 'Volumen', 'Megavolumen', 'Híbrida'][v] },
    original: { ...basic, key: 'option_original', title: 'Distribución original del estilo', description: 'Permite conservar los grupos y la apertura definidos por el estilo o personalizarlos en esta técnica.', less: 'Personalizada.', more: 'Original.', tip: 'La demostración compara una distribución personalizada de seis fibras por grupo con la distribución original de la base elegida.', min: 0, max: 1, step: 1, low: 0, high: 1, captions: ['Distribución personalizada', 'Distribución original del estilo'], formatValue: v => v ? 'Original' : 'Personalizada' },
    fibers_per_group: { ...basic, key: 'option_fibers', title: 'Fibras por grupo', description: 'Define cuántas fibras nacen de cada grupo.', less: 'Una fibra.', more: 'Varias fibras.', tip: 'El ejemplo usa una apertura de 12° para distinguir las fibras y no intercala pelos individuales. El motor limita el total para mantener la fluidez.', min: 1, max: 8, step: 1, low: 1, high: 6, captions: ['Una fibra por grupo', 'Más fibras por grupo'] },
    single_every: { ...basic, key: 'option_single', title: 'Mezcla con fibras individuales', description: 'Intercala una fibra individual cada N grupos para mezclar zonas ligeras y pobladas.', less: 'Sin intercalar.', more: 'Intercaladas.', tip: '0 no intercala fibras individuales. El ejemplo usa grupos de tres fibras con apertura de 12°.', min: 0, max: 8, step: 1, low: 0, high: 2, captions: ['Todos los grupos poblados', 'Una fibra individual cada 2 grupos'] },
    density: { ...basic, key: 'option_density', title: 'Densidad de grupos', description: 'Aumenta o reduce cuántos grupos se distribuyen a lo largo de la tira.', less: 'Más ligero.', more: 'Más poblado.', tip: '1 conserva la cantidad de grupos de la base del estilo. La demostración utiliza grupos de tres fibras.', min: .25, max: 1.5, step: .05, low: .4, high: 1.4, captions: ['Menos grupos', 'Más grupos'] },
    layer_split: { ...basic, key: 'option_layer_split', title: 'Separación en altura', description: 'Reparte las fibras de cada grupo en dos niveles: una más levantada y otra más baja, como las pestañas en Y vistas de costado.', less: 'Mismo nivel.', more: 'Dos niveles.', tip: '0 deja todas las fibras al mismo nivel. Entre 20° y 35° se parece a las pestañas en Y de dos niveles. Se aprecia mejor en la vista de perfil.', min: 0, max: 40, step: 1, low: 0, high: 32, captions: ['Un solo nivel', 'Dos niveles'], formatValue: v => `${Math.round(v)}°` },
    stem: { ...basic, key: 'option_stem', title: 'Tallo del grupo', description: 'Hace que las fibras de cada grupo nazcan juntas en un tallo y recién después se abran, como las pestañas brasileñas o los abanicos prearmados.', less: 'Abre desde la raíz.', more: 'Tallo largo.', tip: '0 abre el abanico desde la raíz. Entre 0.2 y 0.35 se parece a una brasileña: la base se ve como un solo pelo y se abre a la mitad.', min: 0, max: .6, step: .01, low: 0, high: .4, captions: ['Sin tallo', 'Con tallo'], formatValue: v => v.toFixed(2) },
    tip_merge: { ...basic, key: 'option_tip_merge', title: 'Puntas unidas', description: 'Vuelve a juntar las puntas de cada grupo y forma picos, como el efecto laminado o húmedo (wet look) de las 4D y 5D más rectas.', less: 'Puntas abiertas.', more: 'Picos unidos.', tip: '0 deja el abanico abierto. Cerca de 1 las puntas se unen en picos definidos. Combina bien con una apertura grande.', min: 0, max: 1, step: .01, low: 0, high: .9, captions: ['Abanico', 'Picos'], formatValue: v => v.toFixed(2) },
    layer_curl: { ...basic, key: 'option_layer_curl', title: 'Curva del nivel de arriba', description: 'Con separación en altura, da al nivel de arriba una curva distinta del de abajo: por ejemplo arriba más curva (C) y abajo más recta. Son las curvas combinadas.', less: 'Arriba más recta.', more: 'Arriba más curva.', tip: '0 usa la misma curva en los dos niveles. Solo actúa si la separación en altura es mayor que 0. Se aprecia mejor de perfil.', min: -40, max: 40, step: 1, low: -25, high: 30, captions: ['Arriba más recta', 'Arriba más curva'], formatValue: v => `${v > 0 ? '+' : ''}${Math.round(v)}°` },
    spread: { ...basic, key: 'option_spread', title: 'Apertura de cada grupo', description: 'Separa las fibras dentro de cada grupo sin añadir fibras.', less: 'Cerrado.', more: 'Abierto.', tip: 'La demostración utiliza grupos de tres fibras para que se vea la apertura.', min: 0, max: 24, step: .5, low: 0, high: 22, captions: ['Grupos cerrados', 'Grupos abiertos'] }
};
export function optionHelpKeys(kind: OptionKind): OptionHelpKey[] { if (kind === 'color') return []; return kind === 'length' ? ['scale'] : kind === 'thickness' ? ['diameter'] : ['base_technique', 'original', 'fibers_per_group', 'single_every', 'density', 'spread', 'layer_split', 'stem', 'tip_merge', 'layer_curl']; }
export function optionHelpDemo(profile: RenderProfile, kind: OptionKind, source: OptionParameters, key: OptionHelpKey, value: number, styleName: string): TutorialDemo {
    let parameters = { ...source };
    if (kind === 'length')
        parameters.scale = value;
    else if (kind === 'thickness')
        parameters.diameter = value;
    else {
        parameters = { ...optionDefaults, base_technique: source.base_technique ?? 1, fibers_per_group: 3, single_every: 0, density: 1, spread: 12 };
        if (key === 'base_technique')
            parameters = { ...parameters, base_technique: value, fibers_per_group: null, spread: null };
        else if (key === 'original')
            parameters = { ...parameters, fibers_per_group: value ? null : 6, spread: value ? null : 12 };
        else if (key === 'layer_curl')
            parameters = { ...parameters, fibers_per_group: 2, spread: 7, layer_split: 28, layer_curl: value };
        else if (key === 'stem' || key === 'tip_merge')
            parameters = { ...parameters, spread: 18, [key]: value };
        else
            parameters = { ...parameters, [key]: value };
    }
    const demo = optionPreviewDemo(profile, kind, parameters, styleName);
    // Las técnicas se explican con unos pocos grupos; la densidad es la excepción, porque trata de cuántos grupos caben en la tira.
    return (kind === 'technique' && key !== 'density') || kind === 'thickness' ? { ...demo, note: `Ejemplo sobre ${styleName}: se muestran solo unos grupos para ver mejor la fibra.` } : demo;
}
