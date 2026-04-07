import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { UserModel } from '../models/user.model'
import { AuthService } from '../core/services/auth/auth.service'
import variables from '../core/config/variables'

type AuthContextValue = {
  user: UserModel | null
  login: (usuario: string, password: string) => Promise<boolean>
  register: (name: string, password: string, code: string, phone: string) => Promise<boolean>
  logout: () => void
  hasPermission: (requiredPermission: string) => boolean
  isLoading: boolean
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  login: async () => false,
  register: async () => false,
  logout: () => { },
  hasPermission: () => false,
  isLoading: false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const didSyncRef = useRef(false)

  const logout = useCallback(() => {
    localStorage.removeItem(variables.session.tokenName || '_tkn');
    localStorage.removeItem(variables.session.userData || 'user_data');
    setUser(null);
    //AuthService.logout().catch(() => { });
  }, []);

  // Sincroniza el usuario con el servidor usando el endpoint /me
  const syncSession = useCallback(async () => {
    const token = localStorage.getItem(variables.session.tokenName || '_tkn');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await AuthService.me();
      setUser(response.data);
    } catch (error) {
      console.error("Sesión no válida");
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (didSyncRef.current) return;
    didSyncRef.current = true;
    syncSession();
  }, [syncSession]);

  const login = async (usuario: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await AuthService.login({ email: usuario, password });
      const { access_token } = response.data;

      if (access_token) {
        localStorage.setItem(variables.session.tokenName || '_tkn', access_token);
        // Validamos inmediatamente con el servidor para obtener el perfil
        await syncSession();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error en login:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  const register = async (name: string, password: string, code: string, phone: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await AuthService.register({
        username: name,
        email: `${name.toLowerCase().replace(/\s/g, '')}@mapface.com`,
        password: password,
        phone: `${code}${phone}`
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  const hasPermissionFn = (requiredPermission: string) => {
    if (!user) return false;
    if (user.role === 'SuperAdmin') return true;
    return user.permissions?.includes(requiredPermission) || false;
  }

  return (
    <AuthContext.Provider value={{
      user, login, register, logout,
      hasPermission: hasPermissionFn,
      isLoading
    }}>
      {!isLoading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return React.useContext(AuthContext)
}