import { describe, expect, it, vi, beforeEach } from "vitest";
import { claimFreeTool } from "@/server/services/tool-claim";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/sponsorship-policy";
import { PRIZE_SPLITTER_TOOL_SLUG } from "@/server/services/prize-splitter-policy";
import { DRAFT_BAN_TOOL_SLUG } from "@/server/services/draft-ban-policy";
import { TIE_BREAKER_TOOL_SLUG } from "@/server/services/tie-breaker-policy";
import { PAYOUT_TRACKER_TOOL_SLUG } from "@/server/services/payout-tracker-policy";
import { ROSTER_BUILDER_TOOL_SLUG } from "@/server/services/roster-builder-policy";
import {
  claimFreeSponsorshipBillingAction,
  claimFreePrizeSplitterBillingAction,
  claimFreeDraftBanBillingAction,
  claimFreeTieBreakerBillingAction,
  claimFreePayoutTrackerBillingAction,
  claimFreeRosterBuilderBillingAction,
} from "./claim-actions";

vi.mock("@/server/services/tool-claim", () => ({
  claimFreeTool: vi.fn(),
}));

const mockedClaimFreeTool = vi.mocked(claimFreeTool);

const CASES: ReadonlyArray<{
  name: string;
  action: (orgSlug: string) => Promise<{ ok?: boolean; error?: string }>;
  slug: string;
}> = [
  { name: "claimFreeSponsorshipBillingAction", action: claimFreeSponsorshipBillingAction, slug: SPONSORSHIP_TOOL_SLUG },
  { name: "claimFreePrizeSplitterBillingAction", action: claimFreePrizeSplitterBillingAction, slug: PRIZE_SPLITTER_TOOL_SLUG },
  { name: "claimFreeDraftBanBillingAction", action: claimFreeDraftBanBillingAction, slug: DRAFT_BAN_TOOL_SLUG },
  { name: "claimFreeTieBreakerBillingAction", action: claimFreeTieBreakerBillingAction, slug: TIE_BREAKER_TOOL_SLUG },
  { name: "claimFreePayoutTrackerBillingAction", action: claimFreePayoutTrackerBillingAction, slug: PAYOUT_TRACKER_TOOL_SLUG },
  { name: "claimFreeRosterBuilderBillingAction", action: claimFreeRosterBuilderBillingAction, slug: ROSTER_BUILDER_TOOL_SLUG },
];

describe("billing claim actions (server-bound tool slugs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const { name, action, slug } of CASES) {
    it(`${name} calls claimFreeTool with the canonical slug + passthrough orgSlug`, async () => {
      mockedClaimFreeTool.mockResolvedValueOnce({ ok: true });
      const res = await action("acme");
      expect(mockedClaimFreeTool).toHaveBeenCalledTimes(1);
      expect(mockedClaimFreeTool).toHaveBeenCalledWith(slug, "acme");
      expect(res).toEqual({ ok: true });
    });

    it(`${name} propagates an error result unchanged`, async () => {
      mockedClaimFreeTool.mockResolvedValueOnce({ error: "Nope" });
      const res = await action("acme");
      expect(mockedClaimFreeTool).toHaveBeenCalledWith(slug, "acme");
      expect(res).toEqual({ error: "Nope" });
    });

    it(`${name} accepts only the workspace slug (no client toolSlug)`, () => {
      expect(action.length).toBe(1);
    });
  }
});
