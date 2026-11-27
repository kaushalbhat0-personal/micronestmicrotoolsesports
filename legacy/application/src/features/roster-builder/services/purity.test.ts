import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRosterText } from "./parser";
import { detectConflicts } from "./conflicts";
import { assignSlots, buildWorkingModel } from "./slots";
import { buildCopyText, buildCsv } from "./output";

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const DOMAIN_FILES = [
  "src/features/roster-builder/types/index.ts",
  "src/features/roster-builder/schemas/index.ts",
  "src/features/roster-builder/index.ts",
  "src/features/roster-builder/services/normalize.ts",
  "src/features/roster-builder/services/parser.ts",
  "src/features/roster-builder/services/conflicts.ts",
  "src/features/roster-builder/services/slots.ts",
  "src/features/roster-builder/services/output.ts",
];

const BANNED_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bfrom\s+["']react["']/, label: "react import" },
  { pattern: /@\/lib\/supabase/, label: "supabase import" },
  { pattern: /createClient|createAdminClient/, label: "supabase client" },
  { pattern: /localStorage|sessionStorage/, label: "web storage" },
  { pattern: /\bfetch\s*\(/, label: "network fetch" },
  { pattern: /XMLHttpRequest|WebSocket/, label: "network primitive" },
  { pattern: /Math\.random|Date\.now\(\)|new Date\(\)/, label: "nondeterminism source" },
  { pattern: /dangerouslySetInnerHTML|__html/, label: "raw html injection" },
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /console\.(log|info|debug)/, label: "console logging (PII risk)" },
];

/**
 * Domain-layer purity: the roster engine is a stateless client-side
 * utility. No persistence, no network, no database, no randomness, no
 * logging of pasted registrations.
 */
describe("domain purity — no persistence, network, or nondeterminism", () => {
  it("contains none of the banned platform capabilities", () => {
    for (const file of DOMAIN_FILES) {
      const source = sourceOf(file);
      for (const { pattern, label } of BANNED_PATTERNS) {
        expect(source, `${file}: ${label}`).not.toMatch(pattern);
      }
    }
  });

  it("imports only zod, domain types/schemas, and sibling services", () => {
    const allowed = new Set([
      "zod",
      "../types",
      "../schemas",
      "./types",
      "./schemas",
      "./normalize",
      "./parser",
      "./conflicts",
      "./slots",
      "./output",
      "./services/normalize",
      "./services/parser",
      "./services/conflicts",
      "./services/slots",
      "./services/output",
    ]);
    for (const file of DOMAIN_FILES) {
      const source = sourceOf(file);
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(allowed.has(specifier ?? ""), `${file}: import ${specifier}`).toBe(true);
      }
    }
  });

  it("end-to-end pipeline is deterministic for hostile input", () => {
    const hostile = [
      "Team,Player,Contact",
      "Alpha,<script>alert(1)</script>,=HYPERLINK(\"http://e\",\"x\")",
      "Bravo,<img src=x onerror=alert(2)>,+999",
      "Alpha,  rahul  ",
      ",nameless",
      "lonely,",
    ].join("\n");
    const run = () => {
      const parsed = parseRosterText(hostile);
      if (!parsed.ok) throw new Error("expected ok");
      const issues = detectConflicts(parsed.rows, { teamCapacity: 5 });
      const model = buildWorkingModel(parsed.rows);
      return JSON.stringify({ parsed, issues, slots: assignSlots(model.teams), text: buildCopyText(model.teams) });
    };
    expect(run()).toBe(run());
  });

  it("contacts never reach copy text, CSV, or issue messages", () => {
    const parsed = parseRosterText("Alpha\tRahul\tSECRET-991\nBravo\tKaran\tSECRET-992");
    if (!parsed.ok) throw new Error("expected ok");
    const issues = detectConflicts(parsed.rows, { teamCapacity: 5 });
    const model = buildWorkingModel(parsed.rows);
    const leaked = [buildCopyText(model.teams), buildCsv(model.teams), ...issues.map((i) => i.message)].join("\n");
    expect(leaked).not.toContain("SECRET-991");
    expect(leaked).not.toContain("SECRET-992");
  });

  it("completes pathological input quickly (no ReDoS-shaped blowup)", () => {
    const evil = `${"a".repeat(10_000)}\t${" ".repeat(5_000)}b${"\t".repeat(500)}c`;
    const start = Date.now();
    const parsed = parseRosterText(`${evil}\nAlpha\tRahul`);
    const elapsed = Date.now() - start;
    expect(parsed.ok).toBe(true);
    expect(elapsed).toBeLessThan(2_000);
  });
});
