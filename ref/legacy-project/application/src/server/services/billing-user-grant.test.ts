import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUserSponsorshipGrant = vi.fn();

vi.mock("@/server/services/user-sponsorship-service", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/services/user-sponsorship-service")>);
  return {
    ...actual,
    getUserSponsorshipGrant: (...args: unknown[]) => (mockGetUserSponsorshipGrant as (...a: unknown[]) => unknown)(...args),
    // Billing discovery uses the expiry-inclusive lookup so expired paid
    // grants stay visible as the logical Free state. Mirror it here.
    getUserSponsorshipGrantIncludingExpired: (...args: unknown[]) =>
      (mockGetUserSponsorshipGrant as (...a: unknown[]) => unknown)(...args),
  };
});

import { getBillingToolSections } from "./billing-service";

const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();

/** Minimal supabase mock: empty org rows, plan + tool catalogs present. */
function mockClient() {
  const tools = [
    { id: "tool-sponsor", slug: "sponsor-sentinel", is_active: true },
    { id: "tool-prize", slug: "prize-splitter", is_active: true },
  ];
  const plans = [
    { id: "p-s-m", tool_id: "tool-sponsor", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, name: "S", slug: "s", created_at: "" },
  ];
  return {
    from: vi.fn((table: string) => {
      const self: Record<string, unknown> = {};
      self.select = () => self;
      self.eq = () => self;
      self.order = () => self;
      self.limit = () => self;
      self.maybeSingle = async () => ({ data: null, error: null });
      self.single = async () => ({ data: null, error: null });
      self.then = (resolve: (v: unknown) => void) => {
        if (table === "tool_entitlements") resolve({ data: [], error: null });
        else if (table === "tools") resolve({ data: tools, error: null });
        else if (table === "plans") resolve({ data: plans, error: null });
        else if (table === "orders") resolve({ data: [], error: null });
        else resolve({ data: null, error: null });
      };
      return self;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBillingToolSections — caller-scoped user grant (regression)", () => {
  it("authenticated member with valid grant → sponsor covered; grant looked up for the caller", async () => {
    mockGetUserSponsorshipGrant.mockResolvedValue({ id: "g1", expires_at: FUTURE });
    const sections = await getBillingToolSections(mockClient() as never, "org-a", "caller-1");
    expect(mockGetUserSponsorshipGrant).toHaveBeenCalledWith(expect.anything(), "caller-1");
    const card = sections.yourTools.find((t) => t.toolSlug === "sponsor-sentinel");
    expect(card).toBeDefined();
    expect(card!.viaUserGrant).toBe(true);
    expect(sections.availableToAdd.some((t) => t.toolSlug === "sponsor-sentinel")).toBe(false);
  });

  it("foreign user's grant cannot affect the current caller's derivation", async () => {
    // Grant service resolves per userId; caller B has no grant even though
    // caller A (elsewhere) does. The derivation only sees caller B's lookup.
    mockGetUserSponsorshipGrant.mockImplementation(async (_supabase: unknown, userId: string) =>
      userId === "caller-a" ? { id: "g-a", expires_at: FUTURE } : null
    );
    const sections = await getBillingToolSections(mockClient() as never, "org-a", "caller-b");
    expect(mockGetUserSponsorshipGrant).toHaveBeenCalledWith(expect.anything(), "caller-b");
    expect(sections.yourTools.some((t) => t.toolSlug === "sponsor-sentinel")).toBe(false);
    expect(sections.availableToAdd.some((t) => t.toolSlug === "sponsor-sentinel")).toBe(true);
  });

  it("no userId (defensive) → org derivation only, no grant lookup", async () => {
    const sections = await getBillingToolSections(mockClient() as never, "org-a");
    expect(mockGetUserSponsorshipGrant).not.toHaveBeenCalled();
    expect(sections.yourTools).toHaveLength(0);
  });
});
