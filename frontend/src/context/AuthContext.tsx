/**
 * AuthContext — JWT stored in React state only.
 *
 * Security design (intentional, documented):
 * - JWT lives in React state + Context ONLY.
 * - It is NEVER written to localStorage, sessionStorage, or any cookie.
 * - On page refresh the token is lost and the user must re-login.
 *   This is the intended security tradeoff — no persistent credential storage.
 * - The Axios interceptor reads the token from module scope via setApiToken().
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
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // JWT in React state — never serialised to storage.
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Keep the Axios interceptor in sync with the current token.
  useEffect(() => {
    setApiToken(token);
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    setApiToken(null);
  }, []);

  // Listen for 401 responses from any Axios call → auto-logout.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("sv:unauthorized", handler);
    return () => window.removeEventListener("sv:unauthorized", handler);
  }, [logout]);

  const login = useCallback(async (u: string, p: string) => {
    const { data } = await api.post<{ access_token: string }>("/auth/token", {
      username: u,
      password: p,
    });
    setToken(data.access_token);
    setUsername(u);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, username, isAuthenticated: !!token, login, logout }}
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
