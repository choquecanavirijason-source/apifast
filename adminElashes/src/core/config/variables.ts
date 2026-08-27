// Si VITE_API_URL apunta a localhost pero la app se abrió desde otra IP
// (ej. Docker accedido como http://192.168.x.x:3000), "localhost" resolvería
// a la máquina del cliente y no al servidor: en ese caso usamos el mismo
// host desde el que se sirvió la app, manteniendo el puerto del backend.
function resolveApiUrl(): string {
  const envUrl =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : undefined;
  const fallback = "http://localhost:8000";
  const configured = envUrl || fallback;

  if (typeof window === "undefined") return configured;

  try {
    const configuredHost = new URL(configured).hostname;
    const isLocalConfigured = configuredHost === "localhost" || configuredHost === "127.0.0.1";
    const isRemoteAccess =
      window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

    if (isLocalConfigured && isRemoteAccess) {
      const apiPort = new URL(configured).port || "8000";
      return `${window.location.protocol}//${window.location.hostname}:${apiPort}`;
    }
  } catch {
    // configured no es una URL absoluta válida, se usa tal cual
  }

  return configured;
}

const variables = {
  apiUrl: resolveApiUrl(),
  session: {
    tokenName: "_tkn",
    userData: "user_data",
    userRoles: "user_roles",
    userPermissions: "user_permissions",
    sessionExpiresAt: "session_expires_at",
    sessionDurationMinutes: "session_duration_minutes",
  },
};

export default variables;
