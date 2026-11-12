import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));

vi.mock("@/features/bgmi-tournaments", () => ({
  getTournament: vi.fn(async (_client: unknown, slug: string) =>
    slug === "showdown-2026" ? { name: "Showdown 2026", shortName: "Showdown" } : null,
  ),
  getStageDetail: vi.fn(async () => null),
}));

import { generateMetadata as tournamentMetadata } from "@/app/bgmi-tournaments/[tournament]/page";
import { generateMetadata as stageMetadata } from "@/app/bgmi-tournaments/[tournament]/[stage]/page";

/**
 * Unknown-tournament metadata (RCCF-TECHLEAK-FIX-01: F-07).
 * Arbitrary slugs must never be echoed into <title>.
 */
describe("unknown tournament metadata", () => {
  it("does not echo an unknown tournament slug into the title", async () => {
    const meta = await tournamentMetadata({ params: Promise.resolve({ tournament: "nope-not-real" }) });
    expect(String(meta.title)).not.toContain("nope-not-real");
    expect(String(meta.title)).toContain("Tournament");
  });

  it("keeps the valid tournament title unchanged", async () => {
    const meta = await tournamentMetadata({ params: Promise.resolve({ tournament: "showdown-2026" }) });
    expect(String(meta.title)).toContain("Showdown 2026");
  });

  it("does not echo unknown stage slugs into the title", async () => {
    const meta = await stageMetadata({
      params: Promise.resolve({ tournament: "nope-not-real", stage: "evil-stage" }),
    });
    expect(String(meta.title)).not.toContain("nope-not-real");
    expect(String(meta.title)).not.toContain("evil-stage");
  });
});
