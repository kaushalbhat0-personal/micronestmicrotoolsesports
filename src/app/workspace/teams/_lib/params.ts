// Workspace route-boundary helpers (P2). Pure module: no Supabase, no
// next/headers, no rendering.
// - parseWorkspaceTeamId: validates the [id] segment (uuid). Never throws:
//   invalid ids resolve to { invalid: true } so routes render notFound()
//   (no existence oracle, no 500 on hostile segments).
// - buildWorkspaceHref: shareable workspace URLs (no filter state in P2).

export function parseWorkspaceTeamId(raw: string | undefined): { id: string } | { invalid: true } {
  if (typeof raw !== "string" || raw.length === 0) {
    return { invalid: true };
  }
  const trimmed = raw.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  ) {
    return { id: trimmed };
  }
  return { invalid: true };
}

export function isInvalidTeamId(
  parsed: { id: string } | { invalid: true },
): parsed is { invalid: true } {
  return "invalid" in parsed;
}

export function buildWorkspaceHref(
  teamId: string,
  view: "overview" | "settings" | "roster" = "overview",
): string {
  if (view === "overview") {
    return `/workspace/teams/${teamId}`;
  }
  return `/workspace/teams/${teamId}/${view}`;
}
