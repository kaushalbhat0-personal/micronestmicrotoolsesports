import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTemplate, deleteTemplate, ensureStarterTemplate, renameTemplate, updateTemplate } from "./template-service";
import * as templateRepo from "@/server/repositories/draft-templates";

vi.mock("@/server/repositories/draft-templates");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";

const tpl = (overrides: Partial<templateRepo.DraftTemplateRow> = {}): templateRepo.DraftTemplateRow => ({
  id: "tpl-1",
  organization_id: ORG,
  name: "Standard Veto",
  config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null },
  created_by: USER,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe("template-service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a template and rejects duplicates + cap", async () => {
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    vi.mocked(templateRepo.createDraftTemplate).mockResolvedValue(tpl());
    const created = await createTemplate(supabase, ORG, USER, {
      name: "Saturday",
      config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null },
    });
    expect(created.name).toBe("Standard Veto");

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl({ name: "Saturday" })]);
    await expect(
      createTemplate(supabase, ORG, USER, { name: "saturday", config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null } }),
    ).rejects.toThrow(/already exists/);

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue(Array.from({ length: 20 }, (_, i) => tpl({ id: `t${i}`, name: `T${i}` })));
    await expect(
      createTemplate(supabase, ORG, USER, { name: "Extra", config: { sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null } }),
    ).rejects.toThrow(/limit/);
  });

  it("renames with duplicate protection and rejects cross-org", async () => {
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl());
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl(), tpl({ id: "t2", name: "Other" })]);
    vi.mocked(templateRepo.updateDraftTemplate).mockResolvedValue(tpl({ name: "New" }));
    expect((await renameTemplate(supabase, ORG, "tpl-1", "New")).name).toBe("New");
    await expect(renameTemplate(supabase, ORG, "tpl-1", "other")).rejects.toThrow(/already exists/);

    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl({ organization_id: "other" }));
    await expect(renameTemplate(supabase, ORG, "tpl-1", "New")).rejects.toThrow(/Cross-organization/);
  });

  it("ensures starter idempotently", async () => {
    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([tpl()]);
    const existing = await ensureStarterTemplate(supabase, ORG, USER);
    expect(existing).toHaveLength(1);
    expect(templateRepo.createDraftTemplate).not.toHaveBeenCalled();

    vi.mocked(templateRepo.listDraftTemplatesByOrg).mockResolvedValue([]);
    vi.mocked(templateRepo.createDraftTemplate).mockResolvedValue(tpl());
    const seeded = await ensureStarterTemplate(supabase, ORG, USER);
    expect(seeded[0]?.name).toBe("Standard Veto");
  });

  it("updates config and deletes with ownership", async () => {
    vi.mocked(templateRepo.findDraftTemplateById).mockResolvedValue(tpl());
    vi.mocked(templateRepo.updateDraftTemplate).mockResolvedValue(tpl());
    await updateTemplate(supabase, ORG, "tpl-1", { sequence: [{ team: "A", type: "ban" }], pool: ["X", "Y"], teamA: null, teamB: null });
    expect(templateRepo.updateDraftTemplate).toHaveBeenCalledOnce();
    vi.mocked(templateRepo.deleteDraftTemplate).mockResolvedValue(undefined);
    await deleteTemplate(supabase, ORG, "tpl-1");
    expect(templateRepo.deleteDraftTemplate).toHaveBeenCalledOnce();
  });
});
