import { api } from "./api";

function assertUploadPath(path: string) {
  const match =
    /^\/uploads\/(agreements|property-documents|payment-receipts)\/([A-Za-z0-9._-]+)$/.exec(
      path,
    );
  if (!match) throw new Error("Invalid file download path.");
  return match;
}

async function fetchUploadBlob(path: string, inline = false) {
  assertUploadPath(path);
  const url = inline ? `${path}?inline=1` : path;
  const response = await api.get<Blob>(url, { responseType: "blob" });
  const contentType =
    (response.headers["content-type"] as string | undefined) ??
    response.data.type ??
    "application/octet-stream";
  // Ensure the blob has a viewable MIME type (axios may leave it empty).
  if (response.data.type && response.data.type !== "application/octet-stream") {
    return response.data;
  }
  return new Blob([response.data], { type: contentType.split(";")[0].trim() });
}

/**
 * Open an authenticated uploaded file in a new browser tab.
 * Pass `previewTab` from a synchronous click handler (window.open)
 * so the browser does not block the popup after the async fetch.
 */
export async function viewUploadedFile(
  path: string,
  previewTab?: Window | null,
) {
  const tab =
    previewTab && !previewTab.closed
      ? previewTab
      : window.open("about:blank", "_blank");

  try {
    const blob = await fetchUploadBlob(path, true);
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      // Last resort if popups are blocked entirely
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Download an authenticated uploaded file (agreement or property document). */
export async function downloadUploadedFile(path: string, fallbackName?: string) {
  const match = assertUploadPath(path);
  const blob = await fetchUploadBlob(path, false);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName || match[2];
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
