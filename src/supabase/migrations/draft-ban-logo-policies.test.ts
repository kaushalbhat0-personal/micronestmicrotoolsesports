import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20251016000003_draft_ban_logo_policies.sql"), "utf8");
const core = readFileSync(join(process.cwd(), "supabase/migrations/20251016000001_draft_ban_core.sql"), "utf8");

describe("draft-ban logo storage hardening — migration", () => {
  it("derives the organization from the object path (existing {org_id}/logo.* convention)", () => {
    // Same convention the application writes: `${organizationId}/logo.${ext}`
    expect(migration).toMatch(/split_part\(object_name, '\/', 1\)/);
    expect(core).toMatch(/org-logos/);
  });

  it("rejects malformed paths before touching auth state", () => {
    expect(migration).toMatch(/\^.*8.*4.*4.*4.*12.*\$/); // UUID-shape guard
    expect(migration).toMatch(/return false/);
  });

  it("requires owner/admin of the path organization (matches application rule)", () => {
    expect(migration).toMatch(/is_org_admin\(first_segment::uuid\)/);
    expect(migration).not.toMatch(/is_org_member/);
  });

  it("helper is a constrained SECURITY DEFINER granted to authenticated only", () => {
    expect(migration).toMatch(/can_manage_org_logo/);
    expect(migration).toMatch(/security definer/);
    expect(migration).toMatch(/set search_path = public/);
    expect(migration).toMatch(/grant execute on function public\.can_manage_org_logo\(text\) to authenticated/);
    expect(migration).toMatch(/revoke all on function public\.can_manage_org_logo\(text\) from public/);
    expect(migration).not.toMatch(/to anon/);
  });

  it("replaces all three bucket-only write policies with folder-scoped ones", () => {
    for (const old of ["org_logos_admin_write", "org_logos_admin_update", "org_logos_admin_delete"]) {
      expect(migration).toContain(`drop policy if exists ${old} on storage.objects`);
    }
    for (const fresh of ["org_logos_owner_folder_insert", "org_logos_owner_folder_update", "org_logos_owner_folder_delete"]) {
      expect(migration).toContain(fresh);
    }
    // No remaining write policy may rely on bucket_id alone.
    const writeBlocks = migration.match(/for (insert|update|delete) to authenticated[\s\S]*?;/g) ?? [];
    expect(writeBlocks.length).toBe(3);
    for (const block of writeBlocks) {
      expect(block).toContain("can_manage_org_logo(name)");
    }
  });

  it("preserves public read for finalized share rendering (no anon write)", () => {
    // Read path untouched by this migration; core policy remains the only anon grant.
    expect(migration).not.toMatch(/for select/);
    expect(core).toMatch(/org_logos_public_read/);
    expect(migration).not.toMatch(/to anon/);
  });

  it("changes nothing outside storage.objects policies + helper (scope guard)", () => {
    expect(migration).not.toMatch(/create table|alter table|insert into|pricing|billing|entitlement|tournament|webhook/i);
    expect(migration).not.toMatch(/logo_url|http|URL input/i);
  });
});
