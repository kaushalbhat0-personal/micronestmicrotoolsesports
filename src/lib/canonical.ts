// Canonical URL helper for static marketing pages.
// Reads only NEXT_PUBLIC_APP_URL; emits no canonical when unconfigured
// (never invent a domain). No Supabase, no data access.

export function getMarketingBaseUrl(): string | undefined {
  const raw = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function buildMarketingCanonical(path: string): string | undefined {
  const base = getMarketingBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
