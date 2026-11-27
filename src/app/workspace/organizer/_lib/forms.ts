// Organizer workspace form parsing (P9). Pure module: converts untrusted
// form records to the strict writer input contracts. Used by the route
// server actions; tested directly without a database. Parsing NEVER invents
// protected values: owner_user_id, created_by, trust_state, lifecycle,
// counts and membership cause strict-schema rejection, surfaced as messages.

import {
  parseCreateOrganizerInput,
  parseCreateTournamentInput,
  parseUpdateTournamentInput,
} from "@/features/organizers/server/organizer-writer";
import { OrganizerDirectoryValidationError } from "@/features/organizers/domain/organizer";

export interface ParsedOrganizerWorkspaceForm {
  ok: boolean;
  value?: unknown;
  message?: string;
}

function readString(record: Record<string, unknown>, key: string): unknown {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim() === "" ? undefined : value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const parts = value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
}

// Parse an organizer-creation form record into the strict creation contract.
export function parseCreateOrganizerForm(
  record: Record<string, unknown>
): ParsedOrganizerWorkspaceForm {
  const candidate = {
    slug: readString(record, "slug"),
    name: readString(record, "name"),
    description: readOptionalString(record, "description"),
    regionCode: readString(record, "regionCode"),
    organizerType: readString(record, "organizerType"),
    gameKeys: readStringArray(record, "gameKeys"),
    websiteUrl: readOptionalString(record, "websiteUrl"),
    // Protected keys, when present, MUST fail validation (strict schema):
    // they are forwarded deliberately so the schema can reject them.
    ...(record["created_by"] !== undefined ? { created_by: record["created_by"] } : {}),
    ...(record["trust_state"] !== undefined ? { trust_state: record["trust_state"] } : {}),
  };
  try {
    return { ok: true, value: parseCreateOrganizerInput(candidate) };
  } catch (error) {
    if (error instanceof OrganizerDirectoryValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    throw error;
  }
}

function readMoneyMinor(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return Number.NaN as unknown as undefined;
  }
  return parsed;
}

function toMoneyInput(
  record: Record<string, unknown>,
  amountKey: string,
  currencyKey: string
): { amountMinor: number; currency: string } | undefined {
  const amount = readMoneyMinor(record, amountKey);
  const currencyRaw = readOptionalString(record, currencyKey);
  if (amount === undefined && currencyRaw === undefined) {
    return undefined;
  }
  return { amountMinor: amount as number, currency: (currencyRaw ?? "").toUpperCase() };
}

// Parse a tournament-draft form record into the strict creation contract.
export function parseCreateTournamentForm(
  record: Record<string, unknown>
): ParsedOrganizerWorkspaceForm {
  const candidate = {
    organizerId: readString(record, "organizerId"),
    slug: readString(record, "slug"),
    title: readString(record, "title"),
    description: readOptionalString(record, "description"),
    gameKey: readString(record, "gameKey") ?? "bgmi",
    regionCode: readString(record, "regionCode"),
    format: readString(record, "format"),
    startsAt: readString(record, "startsAt"),
    endsAt: readString(record, "endsAt"),
    timezone: readString(record, "timezone"),
    entryFee: toMoneyInput(record, "entryFeeMinor", "entryFeeCurrency"),
    prizePool: toMoneyInput(record, "prizePoolMinor", "prizePoolCurrency"),
    registration: {
      method: "external" as const,
      url: readString(record, "registrationUrl"),
      contactInstructions: readOptionalString(record, "contactInstructions"),
    },
    registrationClosesAt: readOptionalString(record, "registrationClosesAt"),
    // Protected keys forwarded so strict validation rejects them.
    ...(record["created_by"] !== undefined ? { created_by: record["created_by"] } : {}),
    ...(record["lifecycle"] !== undefined ? { lifecycle: record["lifecycle"] } : {}),
    ...(record["verified"] !== undefined ? { verified: record["verified"] } : {}),
  };
  try {
    return { ok: true, value: parseCreateTournamentInput(candidate) };
  } catch (error) {
    if (error instanceof OrganizerDirectoryValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    throw error;
  }
}

// Parse a tournament-edit form record into the strict update contract.
export function parseUpdateTournamentForm(
  tournamentId: string,
  record: Record<string, unknown>
): ParsedOrganizerWorkspaceForm {
  const candidate = {
    tournamentId,
    patch: {
      title: readString(record, "title"),
      description: readOptionalString(record, "description"),
      regionCode: readString(record, "regionCode"),
      format: readString(record, "format"),
      startsAt: readString(record, "startsAt"),
      endsAt: readString(record, "endsAt"),
      timezone: readString(record, "timezone"),
      entryFee: toMoneyInput(record, "entryFeeMinor", "entryFeeCurrency"),
      prizePool: toMoneyInput(record, "prizePoolMinor", "prizePoolCurrency"),
      registration: {
        method: "external" as const,
        url: readString(record, "registrationUrl"),
        contactInstructions: readOptionalString(record, "contactInstructions"),
      },
      registrationClosesAt: readOptionalString(record, "registrationClosesAt"),
      // Protected keys forwarded so strict validation rejects them.
      ...(record["slug"] !== undefined ? { slug: record["slug"] } : {}),
      ...(record["gameKey"] !== undefined ? { gameKey: record["gameKey"] } : {}),
      ...(record["organizerId"] !== undefined ? { organizerId: record["organizerId"] } : {}),
      ...(record["lifecycle"] !== undefined ? { lifecycle: record["lifecycle"] } : {}),
    },
  };
  try {
    return { ok: true, value: parseUpdateTournamentInput(candidate) };
  } catch (error) {
    if (error instanceof OrganizerDirectoryValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    throw error;
  }
}
