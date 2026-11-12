// P11 F-01 regression tests (static SQL review + simulated authorization).
// Trust-state forgery, unauthorized trust transitions, forged verification
// metadata. These assert the migration TEXT and the application boundary;
// they do NOT execute PostgreSQL — runtime verification stays an open item
// (see runtime-verification-strategy.md).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canTouchVerification } from "@/features/organizers/domain/permissions";
import { parseCreateOrganizerInput, parseUpdateOrganizerInput } from "@/features/organizers/server/organizer-writer";
import { stripSqlComments } from "./sql";

const MIG_F01 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261113000001_p11_f01_trust_guard.sql"),
  "utf8"
);
const BODY_F01 = stripSqlComments(MIG_F01);

describe("F-01 trust guard trigger (static)", () => {
  it("freezes trust_state for everyone except moderators", () => {
    expect(MIG_F01).toContain("function public.prevent_unprivileged_trust_change()");
    expect(MIG_F01).toContain("NEW.trust_state is distinct from OLD.trust_state");
    expect(MIG_F01).toContain("not public.is_super_admin()");
    expect(MIG_F01).toMatch(/raise exception 'organizers\.trust_state changes require moderator authority'/);
  });

  it("forces new rows to start unverified (no pre-confirmed minting)", () => {
    expect(MIG_F01).toContain("TG_OP = 'INSERT'");
    expect(MIG_F01).toContain("is distinct from 'not_submitted'");
  });

  it("is fail-closed when moderator authority is unavailable", () => {
    // No fallback path, no role exception, no service-role bypass in the
    // executable body. The only authority referenced is the fail-closed
    // super-admin check.
    expect(BODY_F01).not.toMatch(/service_role/i);
    // No role-name carve-out for organizer roles (quoted role literals would
    // appear in any such exception; `is_super_admin` is the only authority).
    expect(BODY_F01).not.toMatch(/'(owner|admin|editor)'/);
    // The only authority referenced is the fail-closed super-admin check.
    expect(BODY_F01).toContain("public.is_super_admin()");
  });

  it("follows the hardened trigger convention and adds no privilege", () => {
    expect(MIG_F01).toContain("security invoker");
    expect(MIG_F01).toContain("set search_path = ''");
    expect(MIG_F01).toContain(
      "revoke all on function public.prevent_unprivileged_trust_change() from authenticated"
    );
    expect(MIG_F01).not.toMatch(/create policy/i);
    expect(MIG_F01).not.toMatch(/grant (insert|update|select|all)\b/i);
    expect(MIG_F01).toContain(
      "create trigger trg_organizers_trust_guard"
    );
  });

  it("is additive-only: no G1–P9 object touched", () => {
    expect(BODY_F01).not.toMatch(/alter table public\.(organizers|tournaments|app_users)/i);
    expect(BODY_F01).not.toMatch(/drop (table|trigger|function|policy)/i);
  });
});

describe("F-01 trust forgery (simulated boundary)", () => {
  it("creation input rejects forged trust_state", () => {
    expect(() =>
      parseCreateOrganizerInput({
        slug: "nova-events",
        name: "Nova Events",
        regionCode: "india",
        organizerType: "independent",
        gameKeys: ["bgmi"],
        trust_state: "confirmed",
      })
    ).toThrow();
  });

  it("update input rejects forged trust and visibility metadata", () => {
    const base = {
      organizerId: "11111111-1111-4111-8111-111111111111",
      patch: {
        name: "Nova Events",
        regionCode: "india",
        gameKeys: ["bgmi"],
      },
    };
    expect(() =>
      parseUpdateOrganizerInput({ ...base, trustState: "confirmed" })
    ).toThrow();
    expect(() =>
      parseUpdateOrganizerInput({
        ...base,
        patch: { ...(base.patch as object), trust_state: "confirmed" },
      })
    ).toThrow();
    expect(() =>
      parseUpdateOrganizerInput({
        ...base,
        patch: { ...(base.patch as object), reviewer_id: "11111111-1111-4111-8111-111111111111" },
      })
    ).toThrow();
  });

  it("no role — including moderator — can touch verification at the app layer", () => {
    expect(canTouchVerification("owner")).toBe(false);
    expect(canTouchVerification("admin")).toBe(false);
    expect(canTouchVerification("editor")).toBe(false);
    expect(canTouchVerification("moderator")).toBe(false);
  });
});
