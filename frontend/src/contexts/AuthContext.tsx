import CentralAuthGate from '@/components/CentralAuthGate';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  accessToken,
  configureAuth,
  initializeSso,
  signIn,
  signOut,
  endSession,
  type AuthSettings,
} from "@/services/auth-session";
import { api, getApiErrorMessage } from "@/services/api";

export type ChrmsRole = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: ChrmsRole;
  roles: string[];
  department: string;
  designation: string;
  avatar?: string;
  permissions: string[];
}

/** Result is returned synchronously so callers can show accurate error text in toasts */
export type LoginResult = { ok: true } | { ok: false; error: string };

interface AuthContextType {
  authMode: "local" | "keycloak";
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithSSO: (provider: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
  lastError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "chrms_token";
const USER_KEY = "chrms_user";

function mapApiUser(u: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roles?: string[];
  permissions?: string[];
}): User {
  return {
    id: u.id,
    name: u.fullName,
    email: u.email,
    role: u.role,
    roles: u.roles ?? [],
    department: "Chiro City Administration",
    designation: u.role,
    permissions: u.permissions ?? [],
  };
}

export function landingPath(user: User | null): string {
  const choices: [string, string][] = [
    ["dashboard.read", "/dashboard"],
    ["properties.read", "/properties"],
    ["tenants.read", "/tenants"],
    ["rentals.read", "/rentals"],
    ["sales.read", "/sales"],
    ["rental_payments.read", "/payments"],
    ["sale_payments.read", "/payments"],
    ["users.read", "/admin/users"],
    ["roles.read", "/admin/users"],
    ["settings.read", "/admin/settings"],
  ];
  return (
    choices.find(([permission]) =>
      user?.permissions.includes(permission),
    )?.[1] ?? "/no-access"
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<"local" | "keycloak">("keycloak");
  const [lastError, setLastError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const clear = useCallback(() => {
    setUser(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);
  const hydrate = useCallback(async () => {
    const t = await accessToken();
    if (!t) {
      clear();
      return;
    }
    const { data } = await api.get("/auth/me");
    setUser(mapApiUser(data));
    setToken(t);
    setLastError(null);
  }, [clear]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get<AuthSettings>("/auth/config");
        configureAuth(data);
        setAuthMode(data.mode);
        if (data.mode === "keycloak") await initializeSso();
        if (active) await hydrate();
      } catch (error) {
        if (active) {
          clear();
          setLastError(getApiErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setReady(true);
        }
      }
    })();
    const ended = () => {
      clear();
      setLastError("Your session ended. Please sign in again.");
    };
    const refreshed = () => {
      void hydrate().catch((error) => {
        clear();
        setLastError(getApiErrorMessage(error));
      });
    };
    window.addEventListener("chrms:session-ended", ended);
    window.addEventListener("chrms:token-refreshed", refreshed);
    return () => {
      active = false;
      window.removeEventListener("chrms:session-ended", ended);
      window.removeEventListener("chrms:token-refreshed", refreshed);
    };
  }, [clear, hydrate]);
  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResult> => {
    setIsLoading(true);
    setLastError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      await hydrate();
      return { ok: true };
    } catch (e) {
      const error = getApiErrorMessage(e);
      setLastError(error);
      return { ok: false, error };
    } finally {
      setIsLoading(false);
    }
  };
  const loginWithSSO = async (_provider: string): Promise<LoginResult> => {
    try {
      await signIn();
      return { ok: true };
    } catch (e) {
      const error = getApiErrorMessage(e);
      setLastError(error);
      return { ok: false, error };
    }
  };
  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      clear();
      if (authMode === 'local') setIsLoading(false);
    } catch {
      setLastError('Unable to sign out of Chiro Auth. Please try again.');
      setIsLoading(false);
    }
  };
  const hasPermission = (permission: string) => {
    const aliases: Record<string, string[]> = {
      "dashboard.view": ["dashboard.read"],
      "reports.view": ["reports.read"],
      "payments.read": ["rental_payments.read", "sale_payments.read"],
      "payments.write": ["rental_payments.write", "sale_payments.write"],
    };
    return (
      !!user &&
      (aliases[permission] ?? [permission]).some((key) =>
        user.permissions.includes(key),
      )
    );
  };
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
  return (
    <CentralAuthGate active={authMode === 'keycloak'} loading={isLoading} authenticated={!!user} error={lastError} onSignOut={logout}>
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithSSO,
        logout,
        authMode,
        isAuthenticated: !!user && !!token,
        hasPermission,
        isLoading,
        lastError,
      }}
    >
      {children}
    </AuthContext.Provider>
    </CentralAuthGate>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
