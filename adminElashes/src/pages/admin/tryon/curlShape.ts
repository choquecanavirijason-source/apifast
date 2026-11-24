/**
 * Matemática de la curvatura de pestaña, sin JSX: la comparten la vista
 * lateral (CurlPreview.tsx) y la vista previa 3D (previewGeometry.ts). Usa el
 * MISMO modelo que el probador (`LashCurl` en la app): la fibra nace
 * proyectada hacia adelante (BASE_PROJECTION_DEG desde la vertical, como
 * `LASH_PROJECTION_DEG` del motor) y se dobla hacia arriba según grados,
 * posición y nitidez del doblez.
 */
export interface CurlShape {
    curl_deg: number;
    bend_position: number;
    bend_sharpness: number;
}

/** Dirección de nacimiento de la fibra (grados desde la vertical, hacia adelante). */
const BASE_DEG = 70;

/** Ángulo acumulado del doblez en s (0 raíz … 1 punta), en radianes. */
function bendAngle(shape: CurlShape, s: number) {
    const width = .75 + (.06 - .75) * shape.bend_sharpness;
    const t = Math.min(1, Math.max(0, (s - (shape.bend_position - width / 2)) / width));
    return (shape.curl_deg * Math.PI / 180) * t * t * (3 - 2 * t);
}

/**
 * Perfil de la fibra igual que `LashCurl.profile` de la app: `up` sube en la
 * dirección de nacimiento y `back` es lo que se dobló hacia el párpado,
 * muestreado en `samples`+1 puntos con largo de arco 1.
 */
export function curlUpBack(shape: CurlShape, samples: number) {
    const steps = 240;
    const up = [0], back = [0];
    let u = 0, b = 0;
    for (let k = 1; k <= steps; k++) {
        const phi = bendAngle(shape, (k - .5) / steps);
        u += Math.cos(phi) / steps;
        b += Math.sin(phi) / steps;
        if ((k * samples) % steps === 0) { up.push(u); back.push(b); }
    }
    return { up, back };
}

/** Curva por defecto de un estilo sin curvatura elegida (como la app). */
export const curlFromStyle = (curl: number): CurlShape => ({ curl_deg: Math.min(150, Math.max(0, curl * 85)), bend_position: .5, bend_sharpness: .25 });

/** Dirección de nacimiento, exportada para la vista previa 3D. */
export const BASE_PROJECTION_DEG = BASE_DEG;

/** Puntos de la fibra en vista lateral (x = hacia adelante, y = hacia arriba), largo 1. */
export function curlPath(shape: CurlShape, steps = 60) {
    const base = BASE_DEG * Math.PI / 180;
    const points: [number, number][] = [[0, 0]];
    let x = 0, y = 0;
    for (let k = 1; k <= steps; k++) {
        const dir = base - bendAngle(shape, (k - .5) / steps);
        x += Math.sin(dir) / steps;
        y += Math.cos(dir) / steps;
        points.push([x, y]);
    }
    return points;
}

