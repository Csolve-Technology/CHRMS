import Keycloak from "keycloak-js";

export type AuthSettings = {
  mode: "local" | "keycloak";
  url: string;
  realm: string;
  clientId: string;
};
let settings: AuthSettings | undefined;
let keycloak: Keycloak | undefined;
let initialization: Promise<boolean> | undefined;

export function configureAuth(value: AuthSettings) {
  settings = value;
  if (value.mode === "keycloak") {
    localStorage.removeItem("chrms_token");
    localStorage.removeItem("chrms_user");
    keycloak ??= new Keycloak({
      url: value.url,
      realm: value.realm,
      clientId: value.clientId,
    });
  }
}

export function endSession() {
  localStorage.removeItem("chrms_token");
  localStorage.removeItem("chrms_user");
  keycloak?.clearToken();
  window.dispatchEvent(new Event("chrms:session-ended"));
}

export async function accessToken() {
  if (settings?.mode !== "keycloak")
    return localStorage.getItem("chrms_token");
  if (!keycloak?.authenticated) return undefined;
  try {
    await keycloak.updateToken(30);
    return keycloak.token;
  } catch (error) {
    endSession();
    throw error;
  }
}

export function initializeSso() {
  if (!keycloak) throw new Error("Chiro Auth is not configured.");
  keycloak.onAuthLogout = () =>
    window.dispatchEvent(new Event("chrms:session-ended"));
  keycloak.onAuthRefreshSuccess = () =>
    window.dispatchEvent(new Event("chrms:token-refreshed"));
  keycloak.onTokenExpired = () => {
    void accessToken().catch(() => undefined);
  };
  initialization ??= keycloak.init({
    onLoad: "login-required",
    pkceMethod: "S256",
    flow: "standard",
    checkLoginIframe: false,
    scope: "openid profile email",
    redirectUri: `${window.location.origin}/login`,
  });
  return initialization;
}

export async function signIn() {
  if (!keycloak) throw new Error("Chiro Auth is not configured.");
  await keycloak.login({ redirectUri: `${window.location.origin}/login` });
}

export async function signOut() {
  localStorage.removeItem("chrms_token");
  localStorage.removeItem("chrms_user");
  if (keycloak) {
    await keycloak.logout({ redirectUri: `${window.location.origin}/login` });
  } else {
    endSession();
  }
}
