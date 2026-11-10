import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCompletedShareRecord, parseShareToken } from "./share";

function adminWith(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(async () => rpcResult) } as unknown as SupabaseClient;
}

const record = {
  ref_code: "DB-2026-00042",
  match_name: null,
  event_name: "Community Cup",
  format_label: "BO3",
  team_a: "TAG",
  team_b: "Rivals",
  sequence: [
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
  ],
  pool: ["Map A", "Map B", "Map C"],
  actions: [
    { stepIndex: 0, team: "A", type: "ban", item: "Map A", at: new Date().toISOString() },
    { stepIndex: 1, team: "B", type: "ban", item: "Map B", at: new Date().toISOString() },
  ],
  completed_at: new Date().toISOString(),
  organization_name: "TAG Esports",
  organization_logo_url: null,
};

describe("draft-ban share", () => {
  it("rejects malformed tokens", () => {
    expect(() => parseShareToken("not-a-uuid")).toThrow();
    expect(() => parseShareToken("")).toThrow();
    expect(parseShareToken("11111111-1111-4111-8111-111111111111")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns completed records through the narrow RPC", async () => {
    const admin = adminWith({ data: record, error: null });
    const result = await fetchCompletedShareRecord(admin, "11111111-1111-4111-8111-111111111111");
    expect(result?.ref_code).toBe("DB-2026-00042");
    expect(admin.rpc).toHaveBeenCalledWith("get_completed_draft_share", { p_token: "11111111-1111-4111-8111-111111111111" });
  });

  it("returns null on RPC error or missing record (no enumeration signal)", async () => {
    expect(await fetchCompletedShareRecord(adminWith({ data: null, error: { message: "x" } }), "11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(await fetchCompletedShareRecord(adminWith({ data: null, error: null }), "11111111-1111-4111-8111-111111111111")).toBeNull();
  });

  it("rejects payloads with internal fields or incomplete sequences", async () => {
    const withInternals = { ...record, organization_id: "org-1", created_by: "user-1", notes: "private" };
    expect(await fetchCompletedShareRecord(adminWith({ data: withInternals, error: null }), "11111111-1111-4111-8111-111111111111")).toBeNull();
    const incomplete = { ...record, actions: record.actions.slice(0, 1) };
    expect(await fetchCompletedShareRecord(adminWith({ data: incomplete, error: null }), "11111111-1111-4111-8111-111111111111")).toBeNull();
  });

  it("rejects malformed ref codes and bad logo URLs", async () => {
    expect(await fetchCompletedShareRecord(adminWith({ data: { ...record, ref_code: "XYZ-1" }, error: null }), "11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(
      await fetchCompletedShareRecord(adminWith({ data: { ...record, organization_logo_url: "javascript:alert(1)" }, error: null }), "11111111-1111-4111-8111-111111111111"),
    ).toBeNull();
  });
});
