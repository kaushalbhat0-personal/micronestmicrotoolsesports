import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { encodeShareState, decodeShareState, buildShareUrl } from "./share";
import type { PrizeShareState } from "../types";

describe("public share link — RCCF-PRIZE-SPLITTER-03", () => {
  it("Copy Link generates public share URL (not dashboard)", () => {
    const state: PrizeShareState = { v: 1, pool: 100000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] };
    const encoded = encodeShareState(state);
    // New behavior: public route is /share/prize-splitter
    const publicUrl = `https://example.com/share/prize-splitter?s=${encoded}`;
    expect(publicUrl).toContain("/share/prize-splitter?s=");
    expect(publicUrl).not.toContain("/dashboard");
    // buildShareUrl should also work for public base
    const built = buildShareUrl("https://example.com/share/prize-splitter", state);
    expect(built).toContain("/share/prize-splitter?s=");
    expect(built).not.toContain("/dashboard");
  });

  it("public URL decodes to same state (round trip)", () => {
    const state: PrizeShareState = { v: 1, pool: 50000, cur: "USD", method: "ranked", placements: [{ label: "1st", percentage: 60 }, { label: "2nd", percentage: 40 }], ctx: { tournamentName: "Cup" } };
    const url = buildShareUrl("https://example.com/share/prize-splitter", state);
    const u = new URL(url);
    const s = u.searchParams.get("s")!;
    const dec = decodeShareState(s);
    expect(dec.ok).toBe(true);
    expect(dec.state?.pool).toBe(50000);
    expect(dec.state?.cur).toBe("USD");
  });

  it("valid share state renders — public page decodes ok", () => {
    const s: PrizeShareState = { v: 1, pool: 100000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] };
    const enc = encodeShareState(s);
    expect(decodeShareState(enc).ok).toBe(true);
  });

  it("invalid share state fails safely", () => {
    expect(decodeShareState("bad!!!").ok).toBe(false);
    expect(decodeShareState("").ok).toBe(false);
  });

  it("unsupported version fails safely", () => {
    const s: PrizeShareState = { v: 1, pool: 1000, cur: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] };
    const enc = encodeShareState(s);
    const json = Buffer.from(enc.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const obj = JSON.parse(json);
    obj.v = 99;
    const bad = Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    expect(decodeShareState(bad).ok).toBe(false);
    expect(decodeShareState(bad).error).toBe("version");
  });

  it("oversized payload rejected", () => {
    const long = "a".repeat(4001);
    expect(decodeShareState(long).ok).toBe(false);
  });

  it("no dashboard dependency — share state does not contain orgSlug", () => {
    const s: PrizeShareState = { v: 1, pool: 1000, cur: "GBP", method: "percentage", placements: [{ label: "1st", percentage: 100 }] };
    const enc = encodeShareState(s);
    const json = Buffer.from(enc.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    expect(json).not.toContain("orgSlug");
    expect(json).not.toContain("dashboard");
  });

  it("existing dashboard route file still exists (regression)", () => {
    const p = path.join(process.cwd(), "src/app/(dashboard)/dashboard/[orgSlug]/prize-splitter/page.tsx");
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, "utf-8");
    expect(content).toContain("PrizeSplitterCalculator");
  });

  it("public share route file exists and is not protected", () => {
    const p = path.join(process.cwd(), "src/app/share/prize-splitter/page.tsx");
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, "utf-8");
    expect(content).not.toContain("requireOrganizationContext");
    expect(content).not.toContain("requireEntitlement");
    expect(content).not.toContain("service_role");
    expect(content).toContain("decodeShareState");
    expect(content).toContain("calculateSplit");
  });

  it("print CSS does not introduce blank pages (no visibility+absolute hack)", () => {
    const calcPath = path.join(process.cwd(), "src/features/prize-splitter/components/prize-splitter-calculator.tsx");
    const content = fs.readFileSync(calcPath, "utf-8");
    // Old buggy pattern should be gone
    expect(content).not.toContain("body * { visibility: hidden; }");
    expect(content).not.toContain("position: absolute; left: 0; top: 0; width: 100%;");
    // New fix should be present
    expect(content).toContain("@page { margin: 12mm; size: A4; }");
    expect(content).toContain("page-break-inside: avoid");
    expect(content).toContain("print:hidden");
  });

  it("Copy Link in calculator uses public route", () => {
    const calcPath = path.join(process.cwd(), "src/features/prize-splitter/components/prize-splitter-calculator.tsx");
    const content = fs.readFileSync(calcPath, "utf-8");
    expect(content).toContain("/share/prize-splitter?s=");
    expect(content).not.toContain("${window.location.pathname}?s=");
  });
});
