import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { buildPlayerShareSpec, toPlayerShareInput } from "../share/player-card-model";
import type { PublicPlayerCard } from "../domain/directory";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20261128000006_fragix_c1a_registry_ownership_eligibility.sql",
);

describe("FRAGIX-C1A registry ownership policy (static)", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("adds eligibility helper and gates search only", () => {
    expect(sql).toContain("player_bgmi_ownership_registry_eligible");
    expect(sql).toContain("create or replace function public.search_player_directory");
    expect(sql).toContain(
      "and public.player_bgmi_ownership_registry_eligible(pp.user_id)",
    );
    expect(sql).not.toMatch(
      /create or replace function public\.get_player_by_handle[\s\S]*registry_eligible/,
    );
    expect(sql).toContain("get_player_by_handle remains ownership-ungated");
  });

  it("requires approved status and live ID match in helper", () => {
    expect(sql).toContain("c.status = 'approved'");
    expect(sql).toContain("pgp.game_user_id = c.claimed_game_user_id");
    expect(sql).toContain("pgp.game_key = 'bgmi'");
  });

  it("does not widen frozen projection or expose private fields", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    expect(sql).not.toContain("claimed_game_user_id as");
    expect(sql).not.toContain("storage_path");
    expect(sql).not.toContain("internal_reason");
  });

  it("keeps PNG share model available without ownership fields", () => {
    const card: PublicPlayerCard = {
      handle: "sample",
      display_name: "Sample",
      avatar_url: null,
      bio: "bio",
      country_code: "IN",
      game_key: "bgmi",
      game_name: "BGMI",
      ign: "SampleIGN",
      primary_role: null,
      play_modes: [],
      region_code: null,
      availability: [],
    };
    const input = toPlayerShareInput(card, "https://example.test/players/sample");
    expect(input).not.toBeNull();
    const spec = buildPlayerShareSpec(input!);
    expect(JSON.stringify(spec)).not.toContain("game_user_id");
    expect(spec.filenameBase).toContain("sample");
  });
});
