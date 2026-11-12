// P3 valid-slug database-unavailable correction — regression tests (P4).
//
// Contract under test:
// - Invalid slug remains 404 (ValidationError -> notFound, not-found metadata).
// - Database unavailable becomes an intentional unavailable state:
//   OperationError -> inline role="alert" UI + unavailable metadata.
// - No internal database errors are exposed (generic messages only).
//
// Static + unit level: no network, no Supabase client. The reader-level
// mapping is pinned by tournament-reader.test.ts; this file pins the route
// mapping (source audit) and the metadata split.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tournamentSlugSchema } from "@/features/tournaments/schemas/tournament";
import {
  TournamentDirectoryOperationError,
  TournamentDirectoryValidationError,
} from "@/features/tournaments/domain/public-card";
import {
  buildTournamentNotFoundMetadata,
  buildTournamentUnavailableMetadata,
} from "@/app/tournaments/_lib/query";

const here = dirname(fileURLToPath(import.meta.url));
const detailPageSource = readFileSync(join(here, "page.tsx"), "utf8");

describe("P3 unavailable-state correction — invalid slug stays 404", () => {
  it("rejects invalid syntax at the schema boundary", () => {
    expect(tournamentSlugSchema.safeParse("BAD SLUG!").success).toBe(false);
    expect(tournamentSlugSchema.safeParse("test-valid-slug").success).toBe(true);
  });

  it("maps invalid slugs to notFound (no existence oracle)", () => {
    expect(detailPageSource).toContain("TournamentDirectoryValidationError");
    expect(detailPageSource).toContain("notFound()");
    const missing = buildTournamentNotFoundMetadata();
    expect(missing.title).toBe("Tournament not found");
  });
});

describe("P3 unavailable-state correction — valid slug + DB down is unavailable", () => {
  it("distinguishes operation errors from validation errors", () => {
    const validation = new TournamentDirectoryValidationError();
    const operation = new TournamentDirectoryOperationError();
    expect(validation).not.toBeInstanceOf(TournamentDirectoryOperationError);
    expect(operation).not.toBeInstanceOf(TournamentDirectoryValidationError);
    expect(operation.message).toBe("Could not load tournaments. Please retry.");
  });

  it("renders an intentional inline unavailable state (not a throw to 500)", () => {
    expect(detailPageSource).toContain("TournamentDirectoryOperationError");
    expect(detailPageSource).toContain('role="alert"');
    expect(detailPageSource).toContain("Tournament unavailable");
    expect(detailPageSource).toContain("Back to tournaments");
  });

  it("emits unavailable metadata distinct from not-found (never mistaken for missing)", () => {
    const missing = buildTournamentNotFoundMetadata();
    const unavailable = buildTournamentUnavailableMetadata();
    expect(unavailable.title).toBe("Tournament temporarily unavailable");
    expect(unavailable.title).not.toBe(missing.title);
    expect(unavailable.description).not.toContain("does not exist");
  });

  it("exposes no internal database detail in copy", () => {
    const unavailable = buildTournamentUnavailableMetadata();
    const blob = JSON.stringify(unavailable) + detailPageSource;
    expect(blob).not.toContain("does not exist");
    expect(blob).not.toContain("postgrest");
    expect(blob).not.toContain("PGRST");
    expect(blob).not.toContain("function get_tournament_by_slug");
  });
});
