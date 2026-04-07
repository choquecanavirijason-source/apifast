const variables = {
  apiUrl:
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
    "http://localhost:8000",
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
