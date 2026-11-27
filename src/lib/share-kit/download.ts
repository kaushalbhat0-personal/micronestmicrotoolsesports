import { ShareRenderError } from "./types";
import { pngFilename } from "./sanitize-filename";

/** Trigger a browser download for a Blob. Throws ShareRenderError on failure. */
export function downloadBlob(blob: Blob, filenameBase: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new ShareRenderError("Downloads are only available in the browser.");
  }
  if (blob.size <= 0) {
    throw new ShareRenderError("Generated image was empty.");
  }
  const name = pngFilename(filenameBase);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadTextFile(contents: string, filenameBase: string, mime = "text/csv;charset=utf-8"): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new ShareRenderError("Downloads are only available in the browser.");
  }
  const safe = pngFilename(filenameBase).replace(/\.png$/i, ".csv");
  const blob = new Blob([contents], { type: mime });
  if (blob.size <= 0) {
    throw new ShareRenderError("Generated file was empty.");
  }
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safe;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
