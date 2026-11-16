import { accessToken, endSession } from "./auth-session";
import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = config.url === "/auth/config" ? undefined : await accessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for file uploads
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers as { delete?: (key: string) => void } & Record<
      string,
      unknown
    >;
    if (typeof headers.delete === "function") {
      headers.delete("Content-Type");
    } else {
      delete headers["Content-Type"];
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      endSession();
    }
    return Promise.reject(err);
  }
);

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data instanceof Blob) {
      return err.message || "Request failed";
    }
    const payload = data as { message?: string | string[] } | undefined;
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join(", ");
    return err.message || "Request failed";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong";
}
