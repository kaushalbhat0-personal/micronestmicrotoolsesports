import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ResultCard } from "./result-card";
import type { DraftMatch } from "@/types/database";

const LOGO = "https://cdn.example/logo.png";

function match(): DraftMatch {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "org-1",
    created_by: "user-1",
    ref_code: "DB-2026-00042",
    match_name: "Saturday BO3",
    event_name: "Monsoon Cup",
    format_label: "BO3",
    notes: "Decider on Map C",
    team_a: "TAG",
    team_b: "Rivals",
    template_id: null,
    sequence: [
      { team: "A", type: "ban" },
      { team: "B", type: "ban" },
    ],
    pool: ["Map A", "Map B"],
    actions: [
      { stepIndex: 0, team: "A", type: "ban", item: "Map A", at: "2026-10-09T10:00:00.000Z" },
      { stepIndex: 1, team: "B", type: "ban", item: "Map B", at: "2026-10-09T10:01:00.000Z" },
    ],
    status: "completed",
    share_token: "22222222-2222-4222-8222-222222222222",
    cloned_from: null,
    completed_at: "2026-10-09T10:02:00.000Z",
    created_at: "2026-10-09T09:00:00.000Z",
    updated_at: "2026-10-09T10:02:00.000Z",
  };
}

describe("ResultCard branding (paid-only logo)", () => {
  it("paid: renders the organization logo image", () => {
    const html = renderToString(<ResultCard match={match()} organizationName="Acme Esports" organizationLogoUrl={LOGO} />);
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).toContain("Acme Esports logo");
    expect(html).toContain("DB-2026-00042");
  });

  it("free (logo gated to null): renders initials fallback, no image, layout intact", () => {
    const html = renderToString(<ResultCard match={match()} organizationName="Acme Esports" organizationLogoUrl={null} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain(LOGO);
    // Initials fallback with accessible label (existing empty state).
    expect(html).toContain("Acme Esports initials");
    expect(html).toContain("AE");
    // Result content fully intact: teams, record, actions, share/print affordances.
    // (React SSR emits comment nodes between the title expressions, so assert parts.)
    expect(html).toContain("TAG");
    expect(html).toContain("Rivals");
    expect(html).toContain("DB-2026-00042");
    expect(html).toContain("Map A");
    expect(html).toContain("Print result");
    expect(html).toContain("Copy result");
  });

  it("omitted logo prop behaves like the free gate (no broken image)", () => {
    const html = renderToString(<ResultCard match={match()} organizationName="Acme Esports" />);
    expect(html).not.toContain("<img");
    expect(html).toContain("AE");
  });
});
