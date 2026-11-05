import { api } from "./api";

export async function downloadAgreement(path: string) {
  const match = /^\/uploads\/agreements\/([A-Za-z0-9._-]+)$/.exec(path);
  if (!match) throw new Error("Invalid agreement download path.");
  // Always use the authenticated API client, never a token in a URL.
  const response = await api.get<Blob>(path, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = match[1];
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
