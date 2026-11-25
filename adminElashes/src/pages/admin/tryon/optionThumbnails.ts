import { useEffect, useState } from 'react';
import raw from '@/core/config/tryon-templates.json';
import type { OptionKind, OptionParameters, OptionRow, RenderProfile } from '@/core/services/tryon/tryon.service';
import { optionPreviewDemo } from './optionPreview';
import { renderPreviewThumbnail } from './Lash3DPreview';
import type { PreviewCamera } from './Lash3DPreview';

/**
 * Miniaturas 3D de las opciones del catálogo (técnicas). Usan el mismo motor y
 * los mismos datos que el visor del editor, con el mismo estilo de prueba. La
 * vista (ángulo y zoom) es una por defecto y cada técnica puede tener la suya.
 * Se dibujan fuera de pantalla, de una en una (sin un visor activo por
 * tarjeta), y se guardan en memoria por parámetros y vista.
 */
const profile = (raw.templates as Record<string, RenderProfile>).cateye;
/** Cantidad de grupos que muestra la miniatura de una técnica: pocos, para ver la estructura sin parecer un estilo. */
export const SAMPLE_GROUPS = 5;
/** Vista por defecto de las miniaturas: de frente y un poco desde arriba. */
export const DEFAULT_THUMBNAIL_VIEW: PreviewCamera = { yaw: -.15, pitch: .3, zoom: 1.1 };
/** Proporción de las miniaturas (también la del visor donde se elige la vista). */
export const THUMBNAIL_ASPECT = '3 / 2';
const SIZE = [540, 360] as const, STORAGE_KEY = 'tryon.thumbnail.views.v2';
export interface ThumbnailViews { all: PreviewCamera; byId: Record<number, PreviewCamera> }
const valid = (v: unknown): v is PreviewCamera => !!v && typeof v === 'object' && ['yaw', 'pitch', 'zoom'].every(k => Number.isFinite((v as Record<string, unknown>)[k]));
/** Vistas elegidas por quien administra (se recuerdan en este navegador). */
export function loadThumbnailViews(): ThumbnailViews {
    const views: ThumbnailViews = { all: { ...DEFAULT_THUMBNAIL_VIEW }, byId: {} };
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        if (stored && valid(stored.all)) views.all = stored.all;
        if (stored?.byId && typeof stored.byId === 'object') for (const [id, v] of Object.entries(stored.byId)) if (valid(v)) views.byId[Number(id)] = v;
    }
    catch { /* sin almacenamiento */ }
    return views;
}
export function saveThumbnailViews(views: ThumbnailViews) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(views)); } catch { /* sin almacenamiento */ } }
export const viewFor = (views: ThumbnailViews, id: number) => views.byId[id] ?? views.all;

const cache = new Map<string, string>();
const viewKey = (v: PreviewCamera) => [v.yaw, v.pitch, v.zoom].map(n => n.toFixed(2)).join(',');
const keyOf = (kind: OptionKind, p: OptionParameters, v: PreviewCamera) => `${kind}:s${SAMPLE_GROUPS}:${viewKey(v)}:${JSON.stringify(p)}`;

export function useOptionThumbnails(kind: OptionKind, rows: OptionRow[], enabled: boolean, views: ThumbnailViews) {
    const [images, setImages] = useState<Record<number, string>>({});
    const signature = viewKey(views.all) + '|' + Object.entries(views.byId).map(([id, v]) => `${id}:${viewKey(v)}`).join(';');
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const ready: Record<number, string> = {};
        for (const r of rows) { const hit = cache.get(keyOf(kind, r.option.parameters, viewFor(views, r.option.id))); if (hit) ready[r.option.id] = hit; }
        setImages(ready);
        (async () => {
            for (const r of rows) {
                const view = viewFor(views, r.option.id), key = keyOf(kind, r.option.parameters, view);
                if (cache.has(key)) continue;
                await new Promise(res => setTimeout(res, 0));
                if (cancelled) return;
                const demo = optionPreviewDemo(profile, kind, r.option.parameters, 'Cat Eye');
                const url = renderPreviewThumbnail(demo.profile, demo.selection, demo.options, view, SIZE[0], SIZE[1], SAMPLE_GROUPS);
                if (!url) continue;
                cache.set(key, url);
                setImages(prev => ({ ...prev, [r.option.id]: url }));
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, rows, enabled, signature]);
    return images;
}
