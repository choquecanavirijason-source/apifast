import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import variables from '@/core/config/variables';
import type { IAuth, IAuthRequest } from '@/core/types/IAuth';
import { AuthService } from '@/core/services/auth/auth.service';
import type { IPermission } from '@/core/types/IPermission';

interface AuthState {
  user: IAuth | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: IPermission[];
  roles: string[];
  sessionExpiresAt: string | null;
  sessionDurationMinutes: number | null;
}

type NormalizedAuthPayload = {
  user: IAuth | null;
  permissions: IPermission[];
  roles: string[];
  sessionExpiresAt?: string | null;
  sessionDurationMinutes?: number | null;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getSessionDataFromToken = (token?: string | null) => {
  if (!token) {
    return { sessionExpiresAt: null, sessionDurationMinutes: null };
  }

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  const iat = payload?.iat;
  if (typeof exp !== 'number') {
    return { sessionExpiresAt: null, sessionDurationMinutes: null };
  }

  const expiresAt = new Date(exp * 1000).toISOString();
  // Duración total del token en minutos si el backend envía iat (preferido)
  if (typeof iat === 'number') {
    const totalMinutes = Math.max(0, Math.round((exp - iat) / 60));
    return {
      sessionExpiresAt: expiresAt,
      sessionDurationMinutes: totalMinutes,
    };
  }
  const remainingMinutes = Math.max(0, Math.round((exp * 1000 - Date.now()) / 60000));
  return {
    sessionExpiresAt: expiresAt,
    sessionDurationMinutes: remainingMinutes,
  };
};

// Helper function to safely parse localStorage data
const getStoredData = (key: string, fallback: any = null) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const initialState: AuthState = {
  user: getStoredData(variables.session.userData),
  isAuthenticated: !!localStorage.getItem(variables.session.tokenName),
  isLoading: false,
  error: null,
  permissions: getStoredData(variables.session.userPermissions, []),
  roles: getStoredData(variables.session.userRoles, []),
  sessionExpiresAt: localStorage.getItem(variables.session.sessionExpiresAt),
  sessionDurationMinutes: Number(localStorage.getItem(variables.session.sessionDurationMinutes) || 0) || null,
};

const normalizeAuthPayload = (data: any): NormalizedAuthPayload => {
  const user = data?.user ?? (data?.name || data?.role || data?.permissions ? data : null);
  const rawPermissions = data?.permissions ?? user?.permissions ?? user?.role?.permissions ?? [];
  const permissions = (Array.isArray(rawPermissions)
    ? rawPermissions
        .map((permission: unknown) => {
          if (typeof permission === 'string') return permission;
          if (permission && typeof permission === 'object') {
            const value = (permission as { name?: unknown }).name;
            return typeof value === 'string' ? value : null;
          }
          return null;
        })
        .filter(Boolean)
    : []) as IPermission[];

  const rawRoles = data?.roles ?? (user?.role ? [user.role] : []);
  const roles = (Array.isArray(rawRoles)
    ? rawRoles
        .map((role: unknown) => {
          if (typeof role === 'string') return role;
          if (role && typeof role === 'object') {
            const value = (role as { name?: unknown }).name;
            return typeof value === 'string' ? value : null;
          }
          return null;
        })
        .filter(Boolean)
    : []) as string[];
  return { user, permissions, roles };
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: IAuthRequest, { rejectWithValue }) => {
    try {
      const response = await AuthService.login(credentials);
      console.log('Login successful:', response);

      const normalized = normalizeAuthPayload(response.data);
      const fallbackSession = getSessionDataFromToken(response.data.access_token);

      // Store token and additional user data
      localStorage.setItem(variables.session.tokenName, response.data.access_token);
      localStorage.setItem(variables.session.userData, JSON.stringify(normalized.user));
      localStorage.setItem(variables.session.userRoles, JSON.stringify(normalized.roles));
      localStorage.setItem(variables.session.userPermissions, JSON.stringify(normalized.permissions));
      const sessionExpiresAt = response.data.expires_at ?? fallbackSession.sessionExpiresAt;
      const sessionDurationMinutes = response.data.expires_in_minutes ?? fallbackSession.sessionDurationMinutes;
      if (sessionExpiresAt) {
        localStorage.setItem(variables.session.sessionExpiresAt, sessionExpiresAt);
      }
      if (sessionDurationMinutes !== null && sessionDurationMinutes !== undefined) {
        localStorage.setItem(
          variables.session.sessionDurationMinutes,
          String(sessionDurationMinutes)
        );
      }

      return {
        ...normalized,
        sessionExpiresAt,
        sessionDurationMinutes,
      };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Login failed'
      );
    }
  }
);

export const getMe = createAsyncThunk(
  "auth/getMe",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem(variables.session.tokenName);
      const response = await AuthService.me();
      let sessionData: { expires_at?: string | null; expires_in_minutes?: number | null } = {};

      try {
        const sessionResponse = await AuthService.session();
        sessionData = sessionResponse.data ?? {};
      } catch {
        const fallbackSession = getSessionDataFromToken(token);
        sessionData = {
          expires_at: fallbackSession.sessionExpiresAt,
          expires_in_minutes: fallbackSession.sessionDurationMinutes,
        };
      }

      const normalized = normalizeAuthPayload(response.data);

      // Update localStorage with fresh data
      localStorage.setItem(variables.session.userData, JSON.stringify(normalized.user));
      localStorage.setItem(variables.session.userRoles, JSON.stringify(normalized.roles));
      localStorage.setItem(variables.session.userPermissions, JSON.stringify(normalized.permissions));
      if (sessionData?.expires_at) {
        localStorage.setItem(variables.session.sessionExpiresAt, sessionData.expires_at);
      }
      if (sessionData?.expires_in_minutes !== null && sessionData?.expires_in_minutes !== undefined) {
        localStorage.setItem(
          variables.session.sessionDurationMinutes,
          String(sessionData.expires_in_minutes)
        );
      }

      return {
        ...normalized,
        sessionExpiresAt: sessionData?.expires_at ?? null,
        sessionDurationMinutes: sessionData?.expires_in_minutes ?? null,
      };
    } catch (error: any) {
      localStorage.removeItem(variables.session.tokenName);
      localStorage.removeItem(variables.session.userData);
      localStorage.removeItem(variables.session.userRoles);
      localStorage.removeItem(variables.session.userPermissions);
      localStorage.removeItem(variables.session.sessionExpiresAt);
      localStorage.removeItem(variables.session.sessionDurationMinutes);
      return rejectWithValue(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Could not get user information"
      );
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    await AuthService.logout();
  } catch {
    // Ignore errors on logout when the token already expired.
  } finally {
    localStorage.removeItem(variables.session.tokenName);
    localStorage.removeItem(variables.session.userData);
    localStorage.removeItem(variables.session.userRoles);
    localStorage.removeItem(variables.session.userPermissions);
    localStorage.removeItem(variables.session.sessionExpiresAt);
    localStorage.removeItem(variables.session.sessionDurationMinutes);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetAuthState: () => initialState,
    updateSession: (state, action: { payload: { sessionExpiresAt?: string | null; sessionDurationMinutes?: number | null } }) => {
      state.sessionExpiresAt = action.payload.sessionExpiresAt ?? state.sessionExpiresAt;
      state.sessionDurationMinutes = action.payload.sessionDurationMinutes ?? state.sessionDurationMinutes;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.permissions = action.payload.permissions || [];
        state.roles = action.payload.roles || [];
        state.sessionExpiresAt = action.payload.sessionExpiresAt ?? null;
        state.sessionDurationMinutes = action.payload.sessionDurationMinutes ?? null;
        state.isAuthenticated = true;
        state.isLoading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.permissions = [];
        state.roles = [];
        state.sessionExpiresAt = null;
        state.sessionDurationMinutes = null;
      })

      // GetMe
      .addCase(getMe.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.permissions = action.payload.permissions || [];
        state.roles = action.payload.roles || [];
        state.sessionExpiresAt = action.payload.sessionExpiresAt ?? null;
        state.sessionDurationMinutes = action.payload.sessionDurationMinutes ?? null;
        state.isAuthenticated = true;
      })
      .addCase(getMe.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.roles = [];
        state.sessionExpiresAt = null;
        state.sessionDurationMinutes = null;
        state.error = action.payload as string;
      })

      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.roles = [];
        state.sessionExpiresAt = null;
        state.sessionDurationMinutes = null;
      });
  },
});

export const { resetAuthState, updateSession } = authSlice.actions;
export default authSlice.reducer;
