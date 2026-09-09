import axios from "axios";
import { translatePermission } from "./permissionLabels";

// El backend manda el detail de 403 con el slug técnico crudo, ej.
// "Se requiere el permiso: payments:manage" — lo traducimos acá para no
// mostrarle al usuario un identificador en inglés/técnico.
const PERMISSION_DETAIL_PREFIX = "Se requiere el permiso: ";

function translatePermissionDetail(detail: string): string {
  if (!detail.startsWith(PERMISSION_DETAIL_PREFIX)) return detail;
  const slugs = detail.slice(PERMISSION_DETAIL_PREFIX.length).split(", ");
  const translated = slugs.map(translatePermission).join(" o ");
  return `Se requiere el permiso: ${translated}`;
}

/**
 * Mensaje legible desde respuestas FastAPI (detail string, objeto o lista de validación).
 */
export function getApiErrorMessage(error: unknown, fallback = "Error en la solicitud."): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { detail?: unknown; message?: string } | undefined;

    if (data?.message && typeof data.message === "string") {
      return data.message;
    }

    const detail = data?.detail;
    if (typeof detail === "string") {
      return translatePermissionDetail(detail);
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            const loc = "loc" in item && Array.isArray((item as { loc: unknown }).loc)
              ? `${(item as { loc: string[] }).loc.join(".")}: `
              : "";
            return `${loc}${String((item as { msg: string }).msg)}`;
          }
          return JSON.stringify(item);
        })
        .join(" · ");
    }

    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }

    if (status === 401) {
      return "Sesión expirada o no autorizado. Inicia sesión de nuevo.";
    }
    if (status === 403) {
      return "No tienes permiso para esta acción.";
    }
    if (status === 404) {
      return "Recurso no encontrado.";
    }

    if (!error.response && (error.code === "ERR_NETWORK" || error.message === "Network Error")) {
      return "Sin respuesta del servidor (API caída, CORS o VITE_API_URL mal). Reinicia el backend y prueba de nuevo.";
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
