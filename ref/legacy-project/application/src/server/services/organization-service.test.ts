import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOrganizationForUser } from "./organization-service";

const seenTables: string[] = [];
let profileRow: { primary_organization_id: string | null } | null = { primary_organization_id: null };
let updateBehavior: "ok" | "throw" = "ok";
let updateCalls = 0;

function mockClient() {
  return {
    from: vi.fn((table: string) => {
      seenTables.push(table);
      if (table === "organizations") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { id: "org-new", name: "New", slug: "new" }, error: null })),
            })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => (profileRow ? { data: { id: "u1", primary_organization_id: profileRow.primary_organization_id }, error: null } : { data: null, error: { message: "none" } })),
            })),
          })),
          update: vi.fn(() => {
            updateCalls += 1;
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    if (updateBehavior === "throw") throw new Error("rls denied");
                    return { data: { id: "u1", primary_organization_id: "org-new" }, error: null };
                  }),
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  seenTables.length = 0;
  profileRow = { primary_organization_id: null };
  updateBehavior = "ok";
  updateCalls = 0;
  vi.clearAllMocks();
});

describe("createOrganizationForUser — Phase 3 creation behavior", () => {
  it("first organization: created, no sponsor org entitlement, primary set", async () => {
    const org = await createOrganizationForUser(mockClient() as never, "u1", { name: "New", slug: "new" });
    expect(org).toMatchObject({ id: "org-new" });
    // Owner membership is provisioned by the DB trigger, not app code.
    expect(seenTables).toContain("organizations");
    expect(seenTables).toContain("profiles");
    // App code NEVER writes entitlements on the creation path.
    expect(seenTables).not.toContain("tool_entitlements");
    expect(seenTables).not.toContain("user_tool_entitlements");
    expect(seenTables).not.toContain("organization_members");
    // Primary was set exactly once.
    expect(updateCalls).toBe(1);
  });

  it("second organization: primary unchanged", async () => {
    profileRow = { primary_organization_id: "org-first" };
    await createOrganizationForUser(mockClient() as never, "u1", { name: "Second", slug: "second" });
    // Profile read happened, but profiles.update must never run.
    expect(updateCalls).toBe(0);
  });

  it("primary-set failure never fails organization creation", async () => {
    updateBehavior = "throw";
    const org = await createOrganizationForUser(mockClient() as never, "u1", { name: "New", slug: "new" });
    expect(org).toMatchObject({ id: "org-new" });
  });

  it("invalid input still rejected", async () => {
    await expect(createOrganizationForUser(mockClient() as never, "u1", { name: "x", slug: "BAD SLUG!!" })).rejects.toThrow();
  });
});
