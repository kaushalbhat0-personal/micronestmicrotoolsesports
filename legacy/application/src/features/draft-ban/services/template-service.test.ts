import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getToolFreePolicy } from "@/config/tools/policy";
import {
  createTemplate,
  customTemplatesMaxForLevel,
  deleteTemplate,
  ensureStarterTemplate,
  getCustomTemplateUsage,
  isStarterTemplate,
  renameTemplate,
  updateTemplate,
} from "./template-service";
import { FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX, resolveDraftBanAccessLevel } from "@/server/services/draft-ban-policy";
import * as templateRepo from "@/server/repositories/draft-templates";
import { TEMPLATES_PER_ORG_MAX } from "../schemas/draft-config";

vi.mock("@/server/repositories/draft-templates");
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/server/services/draft-ban-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/draft-ban-policy")>()),
  resolveDraftBanAccessLevel: vi.fn(),
}));

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";

const tpl = (overrides: Partial<templateRepo.DraftTemplateRow> = {}): templateRepo.DraftTemplateRow => ({
  id: "tpl-1",
  organization_id: ORG,
  name: "Standard Veto",
  config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null },
  is_starter: false,
  created_by: USER,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const starter = (overrides: Partial<templateRepo.DraftTemplateRow> = {}): templateRepo.DraftTemplateRow =>
  tpl({ id: "starter-1", name: "Standard Veto", is_starter: true, ...overrides });

const custom = (i: number): templateRepo.DraftTemplateRow =>
  tpl({ id: `c${i}`, name: `Custom ${i}`, is_starter: false });

const cfg = { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null } as const;

function access(level: "paid" | "free" | "none") {
  vi.mocked(resolveDraftBanAccessLevel).mockResolvedValue(level);
}

describe("template-service policy wiring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free custom limit is 3 from the policy registry (never hardcoded)", async () => {
    expect(FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX).toBe(3);
    expect(getToolFreePolicy("draft-ban")?.limits.customTemplatesMax).toBe(3);
    expect(customTemplatesMaxForLevel("free")).toBe(3);
  });

  it("paid custom limit stays 20 via TEMPLATES_PER_ORG_MAX (single source)", async () => {
    expect(TEMPLATES_PER_ORG_MAX).toBe(20);
    expect(customTemplatesMaxForLevel("paid")).toBe(20);
  });
});

describe("template-service creation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free 0 → 1 succeeds through the race-safe RPC", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(tpl({ name: "Saturday" }));
    const created = await createTemplate(supabase, ORG, USER, { name: "Saturday", config: { ...cfg } });
    expect(created.name).toBe("Saturday");
    expect(templateRepo.createDraftTemplateViaCap).toHaveBeenCalledOnce();
    // Direct (non-atomic) insert path is never used for custom creation.
    expect(templateRepo.createDraftTemplate).not.toHaveBeenCalled();
  });

  it("free 2 → 3 succeeds; free 3 → 4th rejected as a template-limit error", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([custom(1), custom(2)]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(custom(3));
    await createTemplate(supabase, ORG, USER, { name: "Third", config: { ...cfg } });
    expect(templateRepo.createDraftTemplateViaCap).toHaveBeenCalledOnce();

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([custom(1), custom(2), custom(3)]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockRejectedValue({ code: "DBT01", message: "template_limit_exceeded" });
    const err = await createTemplate(supabase, ORG, USER, { name: "Fourth", config: { ...cfg } }).catch((e) => e);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect((err.details as { draftBanTemplateLimit?: string }).draftBanTemplateLimit).toBe("custom-templates");
    expect(String(err.safeMessage)).not.toMatch(/DBT01|template_limit_exceeded|SQLSTATE/i);
  });

  it("starter templates never consume free slots (starter + 2 custom → 3rd custom allowed)", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([starter(), custom(1), custom(2)]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(custom(3));
    await createTemplate(supabase, ORG, USER, { name: "Third", config: { ...cfg } });
    expect(templateRepo.createDraftTemplateViaCap).toHaveBeenCalledOnce();
  });

  it("free org with starter + 3 custom rejects a 4th custom", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([starter(), custom(1), custom(2), custom(3)]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockRejectedValue({ code: "DBT01", message: "template_limit_exceeded" });
    await expect(createTemplate(supabase, ORG, USER, { name: "Fourth", config: { ...cfg } })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("paid 19 → 20 succeeds; paid 20 → 21st rejected", async () => {
    access("paid");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue(Array.from({ length: 19 }, (_, i) => custom(i)));
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(custom(19));
    await createTemplate(supabase, ORG, USER, { name: "Twentieth", config: { ...cfg } });
    expect(templateRepo.createDraftTemplateViaCap).toHaveBeenCalledOnce();

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue(Array.from({ length: 20 }, (_, i) => custom(i)));
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockRejectedValue({ code: "DBT01", message: "template_limit_exceeded" });
    await expect(createTemplate(supabase, ORG, USER, { name: "Extra", config: { ...cfg } })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects duplicates (service pre-check) and maps RPC duplicate races to validation", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl({ name: "Saturday", is_starter: false })]);
    await expect(createTemplate(supabase, ORG, USER, { name: "saturday", config: { ...cfg } })).rejects.toThrow(/already exists/);
    expect(templateRepo.createDraftTemplateViaCap).not.toHaveBeenCalled();

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockRejectedValue({ code: "23505", message: 'duplicate key value violates unique constraint "draft_templates_org_name_unique"' });
    await expect(createTemplate(supabase, ORG, USER, { name: "Race", config: { ...cfg } })).rejects.toThrow(/already exists/);
  });

  it("no access fails closed with entitlement (never a template row)", async () => {
    access("none");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    await expect(createTemplate(supabase, ORG, USER, { name: "X", config: { ...cfg } })).rejects.toMatchObject({
      code: "ENTITLEMENT_REQUIRED",
    });
    expect(templateRepo.createDraftTemplateViaCap).not.toHaveBeenCalled();
  });

  it("client-supplied access level and starter flags are ignored (server authority)", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(custom(1));
    // A forged is_starter flag in the payload must not reach the repository:
    // the service signature only forwards name/config and the RPC forces custom.
    await createTemplate(supabase, ORG, USER, { name: "Forged", config: { ...cfg }, is_starter: true } as never);
    const call = vi.mocked(templateRepo.createDraftTemplateViaCap).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(call).not.toHaveProperty("is_starter");
    expect(call.organizationId).toBe(ORG);
  });

  it("deleting a custom at cap frees the slot (create succeeds again)", async () => {
    access("free");
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(custom(3));
    vi.mocked(templateRepo.deleteDraftTemplate).mockResolvedValue(undefined);
    await deleteTemplate(supabase, ORG, custom(3).id);
    expect(templateRepo.deleteDraftTemplate).toHaveBeenCalledOnce();

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([custom(1), custom(2)]);
    vi.mocked(templateRepo.createDraftTemplateViaCap).mockResolvedValue(custom(4));
    await createTemplate(supabase, ORG, USER, { name: "Replacement", config: { ...cfg } });
    expect(templateRepo.createDraftTemplateViaCap).toHaveBeenCalledOnce();
  });
});

describe("template-service starter provisioning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is idempotent: existing templates skip the RPC", async () => {
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl()]);
    const existing = await ensureStarterTemplate(supabase, ORG, USER);
    expect(existing).toHaveLength(1);
    expect(templateRepo.ensureStarterDraftTemplateViaRpc).not.toHaveBeenCalled();
    expect(templateRepo.createDraftTemplate).not.toHaveBeenCalled();
  });

  it("provisions via RPC when empty and returns the refreshed list (starter exempt)", async () => {
    vi.mocked(templateRepo.listDraftTemplatesByOrg)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([starter()]);
    vi.mocked(templateRepo.ensureStarterDraftTemplateViaRpc).mockResolvedValue(starter());
    const seeded = await ensureStarterTemplate(supabase, ORG, USER);
    expect(seeded[0]?.name).toBe("Standard Veto");
    expect(isStarterTemplate(seeded[0] as templateRepo.DraftTemplateRow)).toBe(true);
    expect(templateRepo.createDraftTemplate).not.toHaveBeenCalled();
  });
});

describe("template-service ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames with duplicate protection and rejects cross-org", async () => {
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl());
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl(), tpl({ id: "t2", name: "Other" })]);
    vi.mocked(templateRepo.updateDraftTemplate).mockResolvedValue(tpl({ name: "New" }));
    expect((await renameTemplate(supabase, ORG, "tpl-1", "New")).name).toBe("New");
    await expect(renameTemplate(supabase, ORG, "tpl-1", "other")).rejects.toThrow(/already exists/);

    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl({ organization_id: "other" }));
    await expect(renameTemplate(supabase, ORG, "tpl-1", "New")).rejects.toThrow(/Cross-organization/);
  });

  it("updates config and deletes with ownership", async () => {
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl());
    vi.mocked(templateRepo.updateDraftTemplate).mockResolvedValue(tpl());
    await updateTemplate(supabase, ORG, "tpl-1", { sequence: [{ team: "A", type: "ban" }], pool: ["X", "Y"], teamA: null, teamB: null });
    expect(templateRepo.updateDraftTemplate).toHaveBeenCalledOnce();
    vi.mocked(templateRepo.deleteDraftTemplate).mockResolvedValue(undefined);
    await deleteTemplate(supabase, ORG, "tpl-1");
    expect(templateRepo.deleteDraftTemplate).toHaveBeenCalledOnce();

    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl({ organization_id: "other" }));
    await expect(deleteTemplate(supabase, ORG, "tpl-1")).rejects.toThrow(/Cross-organization/);
  });
});

describe("template usage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports custom usage with starters excluded", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([starter(), custom(1), custom(2)]);
    const usage = await getCustomTemplateUsage(supabase, ORG);
    expect(usage.customCount).toBe(2);
    expect(usage.starterCount).toBe(1);
    expect(usage.customMax).toBe(3);
    expect(usage.canCreate).toBe(true);
  });

  it("reports canCreate false at cap", async () => {
    access("free");
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([starter(), custom(1), custom(2), custom(3)]);
    const usage = await getCustomTemplateUsage(supabase, ORG);
    expect(usage.canCreate).toBe(false);
  });
});
