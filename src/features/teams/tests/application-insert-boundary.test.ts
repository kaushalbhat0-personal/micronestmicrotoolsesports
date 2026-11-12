// P14-D3: applications/recruitment are deferred — static assert they stay out of active P14 SQL.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase/migrations");
const p14Bodies = readdirSync(migrationsDir)
  .filter((name) => name.includes("p14_team") || name.includes("p14_admin"))
  .map((name) => readFileSync(path.join(migrationsDir, name), "utf8"))
  .join("\n");

describe("P14 foundation omits deferred application insert surface", () => {
  it("does not recreate applications applicant insert policies", () => {
    expect(p14Bodies).not.toContain('"applications applicant insert"');
    expect(p14Bodies.toLowerCase()).not.toContain("create table public.applications");
  });

  it("does not authorize decision forgery paths", () => {
    expect(p14Bodies.toLowerCase()).not.toContain("decide_application");
    expect(p14Bodies.toLowerCase()).not.toContain("accept_application");
  });
});
