import api from "../api";

export interface AppSettings {
  logo_url: string | null;
  logo_original_name: string | null;
}

/** Antepone el host del backend a una ruta relativa `/media/...` devuelta por la API. */
export function toAbsoluteMediaUrl(relativeUrl: string | null): string | null {
  if (!relativeUrl) return null;
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  return `${api.defaults.baseURL}${relativeUrl}`;
}

export const AppSettingsService = {
  async getLogo() {
    const response = await api.get<AppSettings>("/settings/logo");
    return response.data;
  },

  async uploadLogo(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post<AppSettings>("/settings/logo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async removeLogo() {
    const response = await api.delete<AppSettings>("/settings/logo");
    return response.data;
  },
};
