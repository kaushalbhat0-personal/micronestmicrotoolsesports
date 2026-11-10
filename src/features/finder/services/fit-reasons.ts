import { meetsLevelMinimum, type CompetitiveLevel } from "../domain/levels";
import { regionsCompatible } from "../domain/roles";

/**
 * Finder — factual fit reasons (Phase C matching foundation).
 *
 * Simple explainable facts only — NEVER percentages, NEVER "best fit"
 * or "perfect match" claims. Each reason carries its evidence source so
 * the UI can distinguish SELF-REPORTED from MICRONEST VERIFIED.
 */

export type FitEvidenceSource = "self-reported" | "micronest-verified";

export interface FitReason {
  readonly key: "role" | "region" | "level" | "tryout" | "verification";
  readonly label: string;
  readonly met: boolean;
  readonly source: FitEvidenceSource;
}

export interface FitContext {
  readonly playerRegion: string;
  readonly playerCurrentLevel: CompetitiveLevel;
  readonly playerRoles: ReadonlyArray<string>;
  readonly playerOpenToTryout: boolean;
  readonly playerVerified: boolean;
  readonly postRegion: string;
  readonly postLevelMin: CompetitiveLevel;
  readonly postRoleNeeded: string;
  readonly postTryoutRequired: boolean;
}

/** Factual overlap between one player and one recruitment post. */
export function buildFitReasons(ctx: FitContext): FitReason[] {
  const roleMet =
    ctx.playerRoles.includes(ctx.postRoleNeeded);
  const regionMet = regionsCompatible(ctx.playerRegion, ctx.postRegion);
  let levelMet = false;
  try {
    levelMet = meetsLevelMinimum(ctx.playerCurrentLevel, ctx.postLevelMin);
  } catch {
    levelMet = false;
  }
  const tryoutMet = !ctx.postTryoutRequired || ctx.playerOpenToTryout;

  return [
    {
      key: "role",
      label: roleMet
        ? `Role requested: ${ctx.postRoleNeeded}`
        : `Needs ${ctx.postRoleNeeded} — discuss flexibility in tryout`,
      met: roleMet,
      source: "self-reported",
    },
    {
      key: "region",
      label: regionMet ? "Region compatible" : "Region differs — confirm availability",
      met: regionMet,
      source: "self-reported",
    },
    {
      key: "level",
      label: levelMet
        ? "Level context compatible"
        : "Level context differs — discuss goals in tryout",
      met: levelMet,
      source: "self-reported",
    },
    {
      key: "tryout",
      label: ctx.postTryoutRequired
        ? ctx.playerOpenToTryout
          ? "Open to tryout"
          : "Tryout required — player not marked open"
        : "No tryout required",
      met: tryoutMet,
      source: "self-reported",
    },
    {
      key: "verification",
      label: ctx.playerVerified
        ? "BGMI identity verified"
        : "BGMI identity self-reported (unverified)",
      met: ctx.playerVerified,
      source: ctx.playerVerified ? "micronest-verified" : "self-reported",
    },
  ];
}
