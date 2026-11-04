import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { accessToken, configureAuth, initializeSso, signIn, signOut, endSession, type AuthSettings } from "@/services/auth-session";
import { api, getApiErrorMessage } from "@/services/api";

export type ChrmsRole = "ADMIN" | "HOUSING_OFFICER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: ChrmsRole;
  department: string;
  designation: string;
  avatar?: string;
  permissions: string[];
}

/** Result is returned synchronously so callers can show accurate error text in toasts */
export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

interface AuthContextType {
  authMode: "local" | "keycloak";
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithSSO: (provider: string) => Promise<LoginResult>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
  lastError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "chrms_token";
const USER_KEY = "chrms_user";

function permissionsForRole(role: ChrmsRole): string[] {
  if (role === "ADMIN") return ["*"];
  return [
    "dashboard.view",
    "properties.read",
    "properties.write",
    "tenants.read",
    "tenants.write",
    "rentals.read",
    "rentals.write",
    "sales.read",
    "sales.write",
    "payments.read",
    "payments.write",
    "reports.view",
  ];
}

function mapApiUser(u: {
  id: string;
  email: string;
  fullName: string;
  role: string;
}): User {
  const role = (u.role === "ADMIN" ? "ADMIN" : "HOUSING_OFFICER") as ChrmsRole;
  return {
    id: u.id,
    name: u.fullName,
    email: u.email,
    role,
    department: "Chiro City Administration",
    designation: role === "ADMIN" ? "Administrator" : "Housing Officer",
    permissions: permissionsForRole(role),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<"local" | "keycloak">("local");
  const [lastError, setLastError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const clear = useCallback(() => { setUser(null); setToken(null); queryClient.clear(); }, [queryClient]);
  const hydrate = useCallback(async () => {
    const t = await accessToken();
    if (!t) { clear(); return; }
    const { data } = await api.get("/auth/me");
    setUser(mapApiUser(data)); setToken(t); setLastError(null);
  }, [clear]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get<AuthSettings>("/auth/config");
        configureAuth(data); setAuthMode(data.mode);
        if (data.mode === "keycloak") await initializeSso();
        if (active) await hydrate();
      } catch (error) {
        if (active) { clear(); setLastError(getApiErrorMessage(error)); }
      } finally { if (active) { setIsLoading(false); setReady(true); } }
    })();
    const ended = () => { clear(); setLastError("Your session ended. Please sign in again."); };
    const refreshed = () => { void hydrate().catch(error => { clear(); setLastError(getApiErrorMessage(error)); }); };
    window.addEventListener("chrms:session-ended", ended);
    window.addEventListener("chrms:token-refreshed", refreshed);
    return () => { active = false; window.removeEventListener("chrms:session-ended", ended); window.removeEventListener("chrms:token-refreshed", refreshed); };
  }, [clear, hydrate]);
  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true); setLastError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      await hydrate(); return { ok: true };
    } catch (e) { const error = getApiErrorMessage(e); setLastError(error); return { ok: false, error }; }
    finally { setIsLoading(false); }
  };
  const loginWithSSO = async (_provider: string): Promise<LoginResult> => {
    try { await signIn(); return { ok: true }; }
    catch (e) { const error = getApiErrorMessage(e); setLastError(error); return { ok: false, error }; }
  };
  const logout = () => { clear(); void signOut().catch(() => endSession()); };
  const hasPermission = (permission: string) => !!user && (user.permissions.includes("*") || user.permissions.includes(permission));
  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <img
          src="/logo-chiro-192.png"
          alt="Chiro City Administration"
          width={72}
          height={72}
          className="rounded-full object-contain"
        />
        <p className="text-sm text-muted-foreground">Loading CHRMS…</p>
      </div>
    );
  }
  return <AuthContext.Provider value={{ user, token, login, loginWithSSO, logout, authMode, isAuthenticated: !!user && !!token, hasPermission, isLoading, lastError }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
