/**
 * Browser-only output actions for the roster workspace.
 *
 * Kept out of the pure domain services (which stay free of browser APIs).
 * Never logs content; clipboard and download payloads stay in the page.
 */

/** Copy text via the Clipboard API with a legacy fallback. Never throws. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  try {
    if (typeof document === "undefined") return false;
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Trigger a client-side file download. Returns false outside a browser. */
export function downloadTextFile(filename: string, text: string, mime: string): boolean {
  try {
    if (typeof document === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return false;
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
