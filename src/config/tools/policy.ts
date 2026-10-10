/**
 * Free-policy registry (freemium platform, Phase A).
 *
 * Single lookup point for per-tool Free-tier policy metadata. Tool identity
 * (slugs), commercial availability, and paid plans remain owned by their
 * canonical sources — this registry only records Free-tier posture and must
 * never redefine those facts:
 * - canonical slugs: `src/config/app/tools.ts` + `public.tools` (seeded)
 * - availability: `comingSoon` flag / `tools.is_active`
 * - paid plans: `public.plans`
 *
 * Sponsorship Tracking is the reference implementation; its limits below are
 * descriptive metadata only. Enforcement lives in
 * `src/server/services/sponsorship-limits.ts` (`FREE_*`), which remains
 * authoritative until a later phase migrates callers behind this registry.
 * Tie-Breaker Free (3 locked official records per workspace-local calendar
 * month) is descriptive here; enforcement lives in
 * `src/server/services/tie-breaker-policy.ts` (`FREE_TIE_BREAKER_*`) plus
 * the atomic `consume_tie_breaker_lock` RPC.
 */

export type ToolScope = "user" | "org";

export interface ToolFreePolicy {
  /** Canonical DB slug (e.g. "sponsor-sentinel"). Never invented here. */
  readonly toolSlug: string;
  /**
   * "user": Free entitlement follows the user across member organizations
   * (Sponsorship model). "org": Free access never leaves the organization.
   */
  readonly scope: ToolScope;
  /**
   * Whether a user-level grant may satisfy access for this tool.
   * Only Sponsorship today; org-scoped tools must never consult user grants.
   */
  readonly userGrantable: boolean;
  /** Master Free switch. Sponsorship, Tie-Breaker, and Draft & Ban are enabled. */
  readonly freeEnabled: boolean;
  /** Whether users may self-claim Free via a claim action. */
  readonly claimable: boolean;
  /**
   * Descriptive Free limits (quotas, windows). Enforcement stays in each
   * tool's policy module — there is intentionally no universal quota engine.
   */
  readonly limits: Readonly<Record<string, number | null>>;
}

/**
 * Sponsorship reference limits. Values mirror `FREE_*` in
 * `src/server/services/sponsorship-limits.ts` (canonical, enforced there).
 */
const SPONSORSHIP_LIMITS: Readonly<Record<string, number | null>> = {
  activeCampaigns: 1,
  drafts: 1,
  connectedChannels: 1,
  monthlyChecks: 10,
  historyWindowDays: 7,
};

/**
 * Tie-Breaker Free limits. Values mirror `FREE_TIE_BREAKER_*` in
 * `src/server/services/tie-breaker-policy.ts` (canonical, enforced there
 * and in the `consume_tie_breaker_lock` RPC).
 */
const TIE_BREAKER_LIMITS: Readonly<Record<string, number | null>> = {
  lockedOfficialRecordsPerMonth: 3,
  freeHistoryLimit: 3,
};

/**
 * Draft & Ban Free limits. Descriptive metadata only — no enforcement in
 * this phase. Later phases consume these through a dedicated Draft & Ban
 * policy module plus a transactional completion RPC:
 * one completed official match per workspace-local month, the latest five
 * completed matches visible, and three custom templates (starter templates
 * never consume custom slots).
 */
const DRAFT_BAN_LIMITS: Readonly<Record<string, number | null>> = {
  completedMatchesPerMonth: 1,
  freeHistoryLimit: 5,
  customTemplatesMax: 3,
};

const POLICIES: ReadonlyMap<string, ToolFreePolicy> = new Map([
  [
    "sponsor-sentinel",
    {
      toolSlug: "sponsor-sentinel",
      scope: "user",
      userGrantable: true,
      freeEnabled: true,
      claimable: true,
      limits: SPONSORSHIP_LIMITS,
    },
  ],
  [
    "tie-breaker",
    {
      toolSlug: "tie-breaker",
      scope: "org",
      userGrantable: false,
      freeEnabled: true,
      claimable: true,
      limits: TIE_BREAKER_LIMITS,
    },
  ],
  [
    "draft-ban",
    {
      toolSlug: "draft-ban",
      scope: "org",
      userGrantable: false,
      freeEnabled: true,
      claimable: true,
      limits: DRAFT_BAN_LIMITS,
    },
  ],
  [
    "prize-splitter",
    {
      toolSlug: "prize-splitter",
      scope: "org",
      userGrantable: false,
      freeEnabled: true,
      claimable: true,
      // Intentionally empty: Free is unlimited (calculations, shares, CSV)
      // and unmetered. No quota, ledger, history, template, or branding
      // limits exist for this tool; input-validation bounds elsewhere are
      // integrity guards, not usage limits.
      limits: {},
    },
  ],
]);

/**
 * Registry lookup by canonical slug. Unknown slugs return null so callers
 * fail closed — never inferred, never defaulted.
 */
export function getToolFreePolicy(toolSlug: string): ToolFreePolicy | null {
  return POLICIES.get(toolSlug) ?? null;
}
