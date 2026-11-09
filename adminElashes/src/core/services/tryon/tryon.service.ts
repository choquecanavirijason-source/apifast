import api from "../api";
export interface LengthPoint {
    t: number;
    length: number;
}
export interface RenderProfile {
    length_profile: LengthPoint[];
    roots: number[];
    curl: number;
    fan: number;
    sweep: number;
    spike_every: number;
    spike_offset: number;
    spike_multiplier: number;
    fan_spread: number;
    mega_fan_spread: number;
    width_multiplier: number;
}
export interface StyleDraft {
    key: string;
    name: string;
    description: string;
    thumbnail: string | null;
    builtin_style: string | null;
    profile: RenderProfile | null;
    is_active: boolean;
    sort_order: number;
    allowed_lengths: number[];
    allowed_techniques: number[];
    allowed_thicknesses: number[];
    /** Colores de pestaña disponibles. Los estilos anteriores no lo traen: solo negro (0). */
    allowed_colors?: number[];
    defaults: {
        length: number;
        technique: number;
        thickness: number;
        color?: number;
    };
    eye_types: string[];
    /** Mapeo para la técnica (mm por zona, largo Medio). `null`: lo calcula la app. */
    lash_map?: number[] | null;
}
export interface StyleRow {
    style: StyleDraft;
    revision: number;
    published_revision: number | null;
    updated_at: string;
}
export interface StyleVersion {
    revision: number;
    published_at: string;
    style: StyleDraft;
}
export const TryOnService = {
    list: async () => (await api.get<StyleRow[]>("/catalogs/tryon/styles")).data,
    create: async (style: StyleDraft) => (await api.post<StyleRow>("/catalogs/tryon/styles", style)).data,
    save: async (key: string, revision: number, style: StyleDraft) => (await api.put<StyleRow>(`/catalogs/tryon/styles/${key}`, { expected_revision: revision, style })).data,
    publish: async (key: string, revision: number) => (await api.post<StyleRow>(`/catalogs/tryon/styles/${key}/publish`, { expected_revision: revision })).data,
    history: async (key: string) => (await api.get<StyleVersion[]>(`/catalogs/tryon/styles/${key}/history`)).data,
    restore: async (key: string, revision: number, target: number) => (await api.post<StyleRow>(`/catalogs/tryon/styles/${key}/restore`, { expected_revision: revision, revision: target })).data,
    /** Orden del catálogo: se aplica al instante, sin crear versión. */
    reorder: async (keys: string[]) => (await api.post<StyleRow[]>('/catalogs/tryon/styles/reorder', { keys })).data,
    deleteDraft: async (key: string, revision: number) => api.delete(`/catalogs/tryon/styles/${key}`, { params: { expected_revision: revision } }),
};
export function tryOnError(error: unknown): string {
    const detail = (error as {
        response?: {
            data?: {
                detail?: unknown;
            };
        };
    })?.response?.data?.detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail))
        return detail.map((e: {
            msg?: string;
        }) => e.msg ?? 'Revisa los campos').join('. ');
    return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
export type OptionKind = 'length' | 'technique' | 'thickness' | 'color';
export interface OptionParameters {
    scale: number | null;
    diameter: number | null;
    base_technique: number | null;
    fibers_per_group: number | null;
    single_every: number;
    density: number;
    spread: number | null;
    /** Solo en el catálogo de colores: `#RRGGBB`. */
    color?: string | null;
    /** Solo largos: mm que se desplaza el mapeo del estilo. */
    map_offset_mm?: number | null;
}
export interface SalonOption {
    id: number;
    name: string;
    is_active: boolean;
    sort_order: number;
    parameters: OptionParameters;
}
export interface OptionRow {
    published: (SalonOption & {
        revision: number;
    }) | null;
    option: SalonOption;
    revision: number;
    published_revision: number | null;
}
export type OptionGroups = Record<'length' | 'technique' | 'thickness', OptionRow[]> & { color?: OptionRow[] };
export const TryOnOptionsService = {
    list: async (kind: OptionKind) => (await api.get<OptionRow[]>(`/catalogs/tryon/options/${kind}`)).data,
    create: async (kind: OptionKind, option: SalonOption) => (await api.post<OptionRow>(`/catalogs/tryon/options/${kind}`, option)).data,
    save: async (kind: OptionKind, option: SalonOption, revision: number) => (await api.put<OptionRow>(`/catalogs/tryon/options/${kind}/${option.id}`, { option, expected_revision: revision })).data,
    /** Orden de las opciones: se aplica al instante, sin crear versión. */
    reorder: async (kind: OptionKind, ids: number[]) => (await api.post<OptionRow[]>(`/catalogs/tryon/options/${kind}/reorder`, { ids })).data,
    publish: async (kind: OptionKind, id: number, revision: number) => (await api.post<OptionRow>(`/catalogs/tryon/options/${kind}/${id}/publish`, { expected_revision: revision })).data,
    all: async (): Promise<OptionGroups> => { const [length, technique, thickness, color] = await Promise.all(['length', 'technique', 'thickness', 'color'].map(k => TryOnOptionsService.list(k as OptionKind))); return { length, technique, thickness, color }; }
};


export interface EyeCategory {
    key: string;
    name: string;
    group: 'shape' | 'tilt' | 'lid';
    description: string;
    detection: 'automatic' | 'manual';
    revision: number;
    style_keys: string[];
}
export type EyeCategoryDraft = Pick<EyeCategory, 'name' | 'group' | 'description' | 'style_keys'>;
export const TryOnEyeService = {
    delete: async (key: string, revision: number) => api.delete(`/catalogs/tryon/eye-categories/${key}`, { params: { expected_revision: revision } }),
    list: async () => (await api.get<EyeCategory[]>('/catalogs/tryon/eye-categories')).data,
    create: async (draft: EyeCategoryDraft) => (await api.post<EyeCategory>('/catalogs/tryon/eye-categories', draft)).data,
    save: async (key: string, draft: EyeCategoryDraft, revision: number, styleRevisions: Record<string, number>) =>
        (await api.put<EyeCategory>(`/catalogs/tryon/eye-categories/${key}`, { ...draft, expected_revision: revision, style_revisions: styleRevisions })).data,
};
