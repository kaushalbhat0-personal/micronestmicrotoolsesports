// P8 organization domain — controlled org-type vocabulary (game-agnostic).
// An organization profile represents a competitive entity that may own/manage
// multiple teams. Independent teams remain valid and discoverable regardless
// of any association — association is display-only in P8 and never silent.

export const ORG_TYPES = [
  "professional",
  "semi-professional",
  "amateur",
  "community",
  "collegiate",
  "academy",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];

export function isOrgType(value: unknown): value is OrgType {
  return typeof value === "string" && (ORG_TYPES as ReadonlyArray<string>).includes(value);
}

export function orgTypeLabel(value: OrgType): string {
  switch (value) {
    case "professional":
      return "Professional";
    case "semi-professional":
      return "Semi-professional";
    case "amateur":
      return "Amateur";
    case "community":
      return "Community";
    case "collegiate":
      return "Collegiate";
    case "academy":
      return "Academy";
  }
}
