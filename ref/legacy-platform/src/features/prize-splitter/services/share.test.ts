import { describe, it, expect } from "vitest";
import { encodeShareState, decodeShareState, buildShareUrl } from "./share";
import type { PrizeShareState } from "../types";

describe("share encode/decode", () => {
  it("round trip — percentage method", () => {
    const state: PrizeShareState = { v: 1, pool: 100000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] };
    const enc = encodeShareState(state);
    expect(enc).not.toContain("+");
    expect(enc).not.toContain("/");
    expect(enc).not.toContain("=");
    const dec = decodeShareState(enc);
    expect(dec.ok).toBe(true);
    expect(dec.state?.pool).toBe(100000);
    expect(dec.state?.placements).toEqual(state.placements);
  });

  it("round trip — all methods + context", () => {
    const s: PrizeShareState = { v: 1, pool: 50000, cur: "USD", method: "ranked", placements: [{ label: "1st", percentage: 60 }, { label: "2nd", percentage: 40 }], ctx: { tournamentName: "Cup", date: "2026-10-20", sponsorName: "Acme" } };
    const enc = encodeShareState(s);
    const dec = decodeShareState(enc);
    expect(dec.ok).toBe(true);
    expect(dec.state?.ctx?.tournamentName).toBe("Cup");
    expect(dec.state?.ctx?.sponsorName).toBe("Acme");
  });

  it("equal method round trip", () => {
    const s: PrizeShareState = { v: 1, pool: 100, cur: "EUR", method: "equal", placements: [], equalCount: 3 };
    const enc = encodeShareState(s);
    const dec = decodeShareState(enc);
    expect(dec.ok).toBe(true);
    expect(dec.state?.equalCount).toBe(3);
  });

  it("malformed — empty", () => {
    expect(decodeShareState("").ok).toBe(false);
  });

  it("malformed — bad base64", () => {
    expect(decodeShareState("!!!notbase64!!!").ok).toBe(false);
  });

  it("unsupported version", () => {
    // encode v=1 then hack to v=99
    const s: PrizeShareState = { v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] };
    const enc = encodeShareState(s);
    // decode, mutate version via raw
    const json = Buffer.from(enc.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const obj = JSON.parse(json);
    obj.v = 99;
    const bad = Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodeShareState(bad).ok).toBe(false);
  });

  it("invalid percentage — validation rejects", () => {
    const s: PrizeShareState = { v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }] };
    const enc = encodeShareState(s);
    // 50+30 !=100 so decode should fail validation
    expect(decodeShareState(enc).ok).toBe(false);
  });

  it("invalid currency", () => {
    const json = JSON.stringify({ v: 1, pool: 1000, cur: "JPY", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const enc = Buffer.from(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodeShareState(enc).ok).toBe(false);
  });

  it("oversized placement count — too many truncated? but validation catches 0?", () => {
    // empty placements for percentage should fail
    const json = JSON.stringify({ v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [] });
    const enc = Buffer.from(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodeShareState(enc).ok).toBe(false);
  });

  it("buildShareUrl includes ?s=", () => {
    const s: PrizeShareState = { v: 1, pool: 1000, cur: "GBP", method: "percentage", placements: [{ label: "1st", percentage: 100 }] };
    const url = buildShareUrl("https://example.com/dashboard/org/prize-splitter", s);
    expect(url).toContain("?s=");
    expect(url).toContain("https://example.com");
  });

  it("pool exceeding max rejected", () => {
    const json = JSON.stringify({ v: 1, pool: 2_000_000_000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const enc = Buffer.from(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodeShareState(enc).ok).toBe(false);
  });

  it("canonical percentage preserved (rounded to 2 decimals)", () => {
    // 33.33333 rounds to 33.33 via encode, so 33.33333*3 would be 99.99 invalid
    const sInvalid: PrizeShareState = { v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33333 }, { label: "2nd", percentage: 33.33333 }, { label: "3rd", percentage: 33.33333 }] };
    expect(decodeShareState(encodeShareState(sInvalid)).ok).toBe(false);
    const sValid: PrizeShareState = { v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 33.33 }, { label: "2nd", percentage: 33.33 }, { label: "3rd", percentage: 33.34 }] };
    expect(decodeShareState(encodeShareState(sValid)).ok).toBe(true);
  });
});
