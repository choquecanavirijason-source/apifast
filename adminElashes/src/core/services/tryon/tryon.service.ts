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
    defaults: {
        length: number;
        technique: number;
        thickness: number;
    };
    eye_types: string[];
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
export type OptionKind = 'length' | 'technique' | 'thickness';
export interface OptionParameters {
    scale: number | null;
    diameter: number | null;
    base_technique: number | null;
    fibers_per_group: number | null;
    single_every: number;
    density: number;
    spread: number | null;
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
export type OptionGroups = Record<OptionKind, OptionRow[]>;
export const TryOnOptionsService = {
    list: async (kind: OptionKind) => (await api.get<OptionRow[]>(`/catalogs/tryon/options/${kind}`)).data,
    create: async (kind: OptionKind, option: SalonOption) => (await api.post<OptionRow>(`/catalogs/tryon/options/${kind}`, option)).data,
    save: async (kind: OptionKind, option: SalonOption, revision: number) => (await api.put<OptionRow>(`/catalogs/tryon/options/${kind}/${option.id}`, { option, expected_revision: revision })).data,
    publish: async (kind: OptionKind, id: number, revision: number) => (await api.post<OptionRow>(`/catalogs/tryon/options/${kind}/${id}/publish`, { expected_revision: revision })).data,
    all: async (): Promise<OptionGroups> => { const [length, technique, thickness] = await Promise.all(['length', 'technique', 'thickness'].map(k => TryOnOptionsService.list(k as OptionKind))); return { length, technique, thickness }; }
};
