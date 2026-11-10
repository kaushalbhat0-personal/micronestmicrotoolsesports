import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { CompetitionList } from "./competition-list";
import type { TieBreakerCompetitionRow } from "@/server/repositories/tie-breaker-competitions";

function row(overrides: Partial<TieBreakerCompetitionRow> = {}): TieBreakerCompetitionRow {
  return {
    id: "comp-1",
    organization_id: "org-1",
    created_by: "user-1",
    name: "Monsoon Cup",
    description: null,
    status: "active",
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "h2h"],
    preset_ref: null,
    share_token: "token-1",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("CompetitionList", () => {
  it("shows the first-use empty state with a next action", () => {
    const html = renderToString(<CompetitionList orgSlug="acme" competitions={[]} total={0} />);
    expect(html).toContain("Your official standings start here");
    expect(html).toContain("New competition");
  });

  it("lists competitions with status and record numbers", () => {
    const html = renderToString(
      <CompetitionList
        orgSlug="acme"
        competitions={[row(), row({ id: "comp-2", name: "Winter Cup", status: "locked", record_number: "TB-2026-00001" })]}
        total={2}
      />,
    );
    expect(html).toContain("Monsoon Cup");
    expect(html).toContain("Winter Cup");
    expect(html).toContain("TB-2026-00001");
    expect(html).toContain("Locked");
    expect(html).toContain("Search by name or record number");
  });
});
