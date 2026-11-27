import type { Currency, DistributionMethod, PlacementInput, PrizePublishContext, PrizeShareState } from "../types";
import { SHARE_VERSION, MAX_PRIZE_POOL } from "../types";
import { validateInput } from "./calculation";

function toBase64Url(json: string): string {
  const b64 = Buffer.from(json, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return Buffer.from(b64, "base64").toString("utf-8");
}

export function encodeShareState(state: PrizeShareState): string {
  const normalized: PrizeShareState = {
    v: SHARE_VERSION,
    pool: state.pool,
    cur: state.cur,
    method: state.method,
    placements: state.placements.map((p) => ({ label: p.label.trim(), percentage: Math.round(p.percentage * 100) / 100 })),
    ...(state.equalCount !== undefined ? { equalCount: state.equalCount } : {}),
    ...(state.ctx && (state.ctx.tournamentName || state.ctx.date || state.ctx.sponsorName)
      ? {
          ctx: {
            ...(state.ctx.tournamentName?.trim() ? { tournamentName: state.ctx.tournamentName.trim().slice(0, 80) } : {}),
            ...(state.ctx.date?.trim() ? { date: state.ctx.date.trim().slice(0, 20) } : {}),
            ...(state.ctx.sponsorName?.trim() ? { sponsorName: state.ctx.sponsorName.trim().slice(0, 80) } : {}),
          },
        }
      : {}),
  };
  const json = JSON.stringify(normalized);
  return toBase64Url(json);
}

export interface DecodeResult {
  ok: boolean;
  state?: PrizeShareState;
  error?: string;
}

const VALID_CURRENCIES: Currency[] = ["INR", "USD", "EUR", "GBP"];
const VALID_METHODS: DistributionMethod[] = ["percentage", "equal", "ranked", "custom"];

export function decodeShareState(encoded: string): DecodeResult {
  if (!encoded || typeof encoded !== "string") return { ok: false, error: "empty" };
  if (encoded.length > 4000) return { ok: false, error: "too long" };
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch {
    return { ok: false, error: "base64" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "json" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "shape" };
  const obj = raw as Record<string, unknown>;
  if (obj.v !== SHARE_VERSION) return { ok: false, error: "version" };
  if (typeof obj.pool !== "number" || !Number.isFinite(obj.pool) || obj.pool <= 0 || obj.pool > MAX_PRIZE_POOL) return { ok: false, error: "pool" };
  if (!VALID_CURRENCIES.includes(obj.cur as Currency)) return { ok: false, error: "currency" };
  if (!VALID_METHODS.includes(obj.method as DistributionMethod)) return { ok: false, error: "method" };

  // equalCount if present
  if (obj.equalCount !== undefined) {
    if (typeof obj.equalCount !== "number" || !Number.isInteger(obj.equalCount) || obj.equalCount <= 0 || obj.equalCount > 1000) return { ok: false, error: "equalCount" };
  }

  // placements array
  if (!Array.isArray(obj.placements)) return { ok: false, error: "placements" };
  const placements: PlacementInput[] = [];
  for (const item of obj.placements as unknown[]) {
    if (!item || typeof item !== "object") return { ok: false, error: "placement shape" };
    const p = item as Record<string, unknown>;
    if (typeof p.label !== "string" || typeof p.percentage !== "number" || !Number.isFinite(p.percentage)) return { ok: false, error: "placement values" };
    const cp = Math.round((p.percentage as number) * 100) / 100;
    placements.push({ label: String(p.label).slice(0, 40), percentage: cp });
  }

  // ctx optional
  let ctx: PrizePublishContext | undefined;
  if (obj.ctx !== undefined) {
    if (!obj.ctx || typeof obj.ctx !== "object") return { ok: false, error: "ctx shape" };
    const c = obj.ctx as Record<string, unknown>;
    ctx = {};
    if (c.tournamentName !== undefined) {
      if (typeof c.tournamentName !== "string") return { ok: false, error: "ctx tournamentName" };
      ctx.tournamentName = c.tournamentName.slice(0, 80);
    }
    if (c.date !== undefined) {
      if (typeof c.date !== "string") return { ok: false, error: "ctx date" };
      ctx.date = c.date.slice(0, 20);
    }
    if (c.sponsorName !== undefined) {
      if (typeof c.sponsorName !== "string") return { ok: false, error: "ctx sponsorName" };
      ctx.sponsorName = c.sponsorName.slice(0, 80);
    }
    if (!ctx.tournamentName && !ctx.date && !ctx.sponsorName) ctx = undefined;
  }

  const candidate: PrizeShareState = {
    v: SHARE_VERSION,
    pool: obj.pool as number,
    cur: obj.cur as Currency,
    method: obj.method as DistributionMethod,
    placements: placements,
    ...(obj.equalCount !== undefined ? { equalCount: obj.equalCount as number } : {}),
    ...(ctx ? { ctx } : {}),
  };

  // Run through canonical validation (untrusted input)
  const input = {
    prizePool: candidate.pool,
    currency: candidate.cur,
    method: candidate.method,
    placements: candidate.method === "equal" ? [] : candidate.placements,
    equalCount: candidate.method === "equal" ? candidate.equalCount : undefined,
  };
  const validation = validateInput(input as never);
  if (!validation.valid) return { ok: false, error: "validation: " + validation.errors.map((e) => e.message).join("; ") };

  return { ok: true, state: candidate };
}

export function buildShareUrl(baseUrl: string, state: PrizeShareState): string {
  const encoded = encodeShareState(state);
  const url = new URL(baseUrl);
  url.searchParams.set("s", encoded);
  return url.toString();
}
