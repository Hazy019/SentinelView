/**
 * AuthContext — Multi-Tenant JWT & Refresh Session Management.
 *
 * Security design:
 * - Access token in memory (never written to localStorage or cookies).
 * - Automatic refresh token rotation via POST /auth/refresh.
 * - Multi-tenant isolation: binds sessions to tenant_id.
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api, { setApiToken } from "@/lib/api";

export interface AuthContextValue {
  token: string | null;
  username: string | null;
  tenantId: string;
  apiKey: string | null;
  isDemo: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, tenantId?: string) => Promise<void>;
  register: (username: string, password: string, tenantName?: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenVal, setRefreshTokenVal] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>("default_tenant");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Keep the Axios interceptor in sync with the current token.
  useEffect(() => {
    setApiToken(token);
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setRefreshTokenVal(null);
    setUsername(null);
    setTenantId("default_tenant");
    setApiKey(null);
    setIsDemo(false);
    setApiToken(null);
  }, []);

  // Silent Token Refresh Handler
  const refreshToken = useCallback(async () => {
    if (!refreshTokenVal) {
      logout();
      return;
    }
    try {
      const { data } = await api.post<{
        access_token: string;
        refresh_token?: string;
        tenant_id: string;
        api_key?: string;
        is_demo?: boolean;
      }>("/auth/refresh", {
        refresh_token: refreshTokenVal,
      });
      setToken(data.access_token);
      if (data.refresh_token) setRefreshTokenVal(data.refresh_token);
      if (data.tenant_id) setTenantId(data.tenant_id);
      if (data.api_key) setApiKey(data.api_key);
      if (typeof data.is_demo === "boolean") setIsDemo(data.is_demo);
    } catch {
      logout();
    }
  }, [refreshTokenVal, logout]);

  // Listen for 401 responses from any Axios call → trigger refresh or auto-logout.
  useEffect(() => {
    const handler = () => {
      if (refreshTokenVal) {
        refreshToken();
      } else {
        logout();
      }
    };
    window.addEventListener("sv:unauthorized", handler);
    return () => window.removeEventListener("sv:unauthorized", handler);
  }, [logout, refreshToken, refreshTokenVal]);

  const login = useCallback(
    async (u: string, p: string, tenant: string = "default_tenant") => {
      const { data } = await api.post<{
        access_token: string;
        refresh_token?: string;
        tenant_id?: string;
        api_key?: string;
        is_demo?: boolean;
      }>("/auth/token", {
        username: u,
        password: p,
        tenant_id: tenant,
      });
      setToken(data.access_token);
      if (data.refresh_token) setRefreshTokenVal(data.refresh_token);
      setUsername(u);
      setTenantId(data.tenant_id || tenant);
      setApiKey(data.api_key || null);
      setIsDemo(Boolean(data.is_demo || u === "demo"));
    },
    []
  );

  const register = useCallback(
    async (u: string, p: string, tenantName?: string) => {
      const { data } = await api.post<{
        access_token: string;
        refresh_token?: string;
        tenant_id?: string;
        api_key?: string;
        is_demo?: boolean;
      }>("/auth/register", {
        username: u,
        password: p,
        tenant_name: tenantName || undefined,
      });
      setToken(data.access_token);
      if (data.refresh_token) setRefreshTokenVal(data.refresh_token);
      setUsername(u);
      setTenantId(data.tenant_id || `tenant_${u.toLowerCase()}`);
      setApiKey(data.api_key || null);
      setIsDemo(false);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        tenantId,
        apiKey,
        isDemo,
        isAuthenticated: !!token,
        login,
        register,
        refreshToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
