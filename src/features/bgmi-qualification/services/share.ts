import type { QualificationScenario, QualificationShareState } from "../types";
import { QUALIFICATION_SHARE_VERSION } from "../types";
import { getPresetById } from "./presets";
import { MAX_MATCHES, MAX_POINTS, isValidFinishes, isValidPlacement } from "./scoring";

/**
 * Share-state encode/decode for `/share/bgmi-qualification?s=`.
 * Same hardened pattern as the prize-splitter share module: versioned
 * base64url JSON, strict bounds, untrusted input re-validated on decode.
 * Malformed input returns ok:false — never throws, never trusts.
 */

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

export interface DecodeResult {
  readonly ok: boolean;
  readonly state?: QualificationShareState;
  readonly error?: string;
}

const MAX_SCENARIOS = 3;

function isBoundedInt(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

export function encodeShareState(state: QualificationShareState): string {
  const normalized: QualificationShareState = {
    v: QUALIFICATION_SHARE_VERSION,
    current: state.current,
    target: state.target,
    matches: state.matches,
    preset: state.preset,
    scenarios: state.scenarios.slice(0, MAX_SCENARIOS).map((s) => ({ placement: s.placement, finishes: s.finishes })),
    averageRate: state.averageRate,
  };
  return toBase64Url(JSON.stringify(normalized));
}

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
  if (obj.v !== QUALIFICATION_SHARE_VERSION) return { ok: false, error: "version" };
  if (!isBoundedInt(obj.current, MAX_POINTS)) return { ok: false, error: "current" };
  if (!isBoundedInt(obj.target, MAX_POINTS)) return { ok: false, error: "target" };
  if (!isBoundedInt(obj.matches, MAX_MATCHES)) return { ok: false, error: "matches" };
  if (typeof obj.preset !== "string") return { ok: false, error: "preset" };
  const preset = getPresetById(obj.preset);
  if (!Array.isArray(obj.scenarios) || obj.scenarios.length > MAX_SCENARIOS) return { ok: false, error: "scenarios" };
  const scenarios: QualificationScenario[] = [];
  for (const item of obj.scenarios as unknown[]) {
    if (!item || typeof item !== "object") return { ok: false, error: "scenario shape" };
    const s = item as Record<string, unknown>;
    if (!isValidPlacement(preset, s.placement) || !isValidFinishes(preset, s.finishes)) {
      return { ok: false, error: "scenario values" };
    }
    scenarios.push({ placement: s.placement, finishes: s.finishes });
  }
  let averageRate: number | null = null;
  if (obj.averageRate !== null && obj.averageRate !== undefined) {
    if (typeof obj.averageRate !== "number" || !Number.isFinite(obj.averageRate) || obj.averageRate < 0 || obj.averageRate > 999) {
      return { ok: false, error: "averageRate" };
    }
    averageRate = obj.averageRate;
  }
  return {
    ok: true,
    state: {
      v: QUALIFICATION_SHARE_VERSION,
      current: obj.current,
      target: obj.target,
      matches: obj.matches,
      preset: preset.id,
      scenarios,
      averageRate,
    },
  };
}

export function buildShareUrl(baseUrl: string, state: QualificationShareState): string {
  const url = new URL(baseUrl);
  url.searchParams.set("s", encodeShareState(state));
  return url.toString();
}
