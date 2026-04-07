import axios from "axios";

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
      return detail;
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

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
