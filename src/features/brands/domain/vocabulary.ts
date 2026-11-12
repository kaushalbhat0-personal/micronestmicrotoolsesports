// P8 brand vocabularies — controlled, game-agnostic.
// A brand is a commercial entity distinct from an esports organization.
// Industry, partnership types and sponsorship interests are declared intent
// only: they never prove the brand is looking for partners, and they never
// prove the viewer represents the brand.

export const BRAND_INDUSTRIES = [
  "gaming-hardware",
  "peripherals",
  "apparel",
  "energy-drink",
  "food-beverage",
  "fintech",
  "telecom",
  "automotive",
  "media",
  "other",
] as const;

export type BrandIndustry = (typeof BRAND_INDUSTRIES)[number];

export function isBrandIndustry(value: unknown): value is BrandIndustry {
  return typeof value === "string" && (BRAND_INDUSTRIES as ReadonlyArray<string>).includes(value);
}

export const PARTNERSHIP_TYPES = [
  "sponsorship",
  "product-partnership",
  "content-collaboration",
  "event-partnership",
  "affiliate",
  "other",
] as const;

export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number];

export function isPartnershipType(value: unknown): value is PartnershipType {
  return (
    typeof value === "string" && (PARTNERSHIP_TYPES as ReadonlyArray<string>).includes(value)
  );
}

export const SPONSORSHIP_INTERESTS = [
  "teams",
  "players",
  "events",
  "content-creators",
  "all",
] as const;

export type SponsorshipInterest = (typeof SPONSORSHIP_INTERESTS)[number];

export function isSponsorshipInterest(value: unknown): value is SponsorshipInterest {
  return (
    typeof value === "string" && (SPONSORSHIP_INTERESTS as ReadonlyArray<string>).includes(value)
  );
}
