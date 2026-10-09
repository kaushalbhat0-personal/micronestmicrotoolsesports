import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("connections page — OAuth entry points restored", () => {
  const page = src("src/app/(dashboard)/dashboard/[orgSlug]/connections/page.tsx");

  it("renders IntegrationsForm on the production Connections page", () => {
    expect(page).toContain("IntegrationsForm");
    expect(page).toContain("<IntegrationsForm");
    expect(page).toContain('from "@/features/sponsor-sentinel/components/integrations-form"');
  });

  it("passes server-side availability (never faked)", () => {
    expect(page).toContain("getOAuthAvailability");
    expect(page).toContain("availability={availability}");
  });

  it("passes real masked credential views (no credential values)", () => {
    expect(page).toContain("toMaskedView");
    expect(page).not.toContain("accessToken");
    expect(page).not.toContain("refreshToken");
    expect(page).not.toContain("client_secret");
  });

  it("shows customer-safe channel-save failure state (no success claim)", () => {
    expect(page).toContain("channel_save_failed");
    expect(page).toContain("couldn't be saved");
  });

  it("no stale Kick 'coming soon' wording", () => {
    expect(page.toLowerCase()).not.toContain("coming soon");
  });
});

describe("dashboard error boundary — never renders internals", () => {
  const boundary = src("src/app/(dashboard)/error.tsx");

  it("never renders error.message directly", () => {
    expect(boundary).not.toContain("error.message");
  });

  it("uses the explicit customer-safe mapping", () => {
    expect(boundary).toContain("mapDashboardError");
  });

  it("authentication failure offers Sign in via /login (no retry loop)", () => {
    expect(boundary).toContain('href="/login"');
    expect(boundary).toContain("Sign in");
  });

  it("retry is only offered for genuinely retryable failures", () => {
    // showRetry-gated reset; auth/access views suppress retry.
    expect(boundary).toContain("showRetry");
  });
});

describe("OAuth start routes — org context derived server-side", () => {
  for (const provider of ["twitch", "youtube", "kick"] as const) {
    it(`${provider}: authorization binds to server-derived org id`, () => {
      const route = src(`src/app/api/auth/${provider}/start/route.ts`);
      expect(route).toContain("requireOrganizationContext");
      expect(route).toContain("requireEntitlement");
      expect(route).toContain("organizationId: ctx.organization.id");
      expect(route).not.toContain("organization_id");
    });
  }
});

describe("OAuth callbacks — no success claim on persistence failure", () => {
  for (const provider of ["twitch", "youtube", "kick"] as const) {
    it(`${provider}: channel save failure redirects to failure state`, () => {
      const route = src(`src/app/api/auth/${provider}/callback/route.ts`);
      expect(route).toContain("channel_save_failed");
      expect(route).toContain("/connections");
      expect(route).toContain("couldn't save the connection");
    });

    it(`${provider}: no raw DB/provider internals in failure responses`, () => {
      const route = src(`src/app/api/auth/${provider}/callback/route.ts`);
      expect(route).not.toContain("Persist failed");
      expect(route).not.toContain("Token exchange failed");
      expect(route).not.toContain("errorDescription");
    });
  }
});

describe("security boundaries preserved (static)", () => {
  it("channel actions never accept organization_id from the browser", () => {
    const actions = src("src/features/sponsor-sentinel/actions/channel-actions.ts");
    expect(actions).not.toContain('formData.get("organization_id")');
    expect(actions).not.toContain("searchParams");
    expect(actions).toContain("requireOrganizationContext(orgSlug)");
    expect(actions).toContain("getConnectedChannel(supabase, ctx.organization.id");
  });

  it("user grants consulted ONLY for sponsor-sentinel", () => {
    const gate = src("src/lib/auth/require-entitlement.ts");
    // Both sponsorship branches resolve through the single access-level
    // resolver (which also encodes expired-paid → Free); the unexpired-only
    // helper is no longer the gate decision. Fence stays sponsor-only.
    expect(gate).not.toContain("hasUserSponsorshipAccess");
    // Exactly the two sponsorship branches (gate + slugs helper) consult the
    // shared resolver; operational tools never do.
    const resolverUses = gate.match(/await import\("@\/server\/services\/sponsorship-limits"\)/g) ?? [];
    expect(resolverUses).toHaveLength(2);
    expect(gate).toContain("toolSlug === SPONSORSHIP_TOOL_SLUG");
    expect(gate).toContain("slugs.push(SPONSORSHIP_TOOL_SLUG)");
  });

  it("disconnect verifies ownership before delete", () => {
    const actions = src("src/features/sponsor-sentinel/actions/channel-actions.ts");
    expect(actions).toContain("deleteConnectedChannel(supabase, channel.id)");
  });

  it("callbacks verify state, PKCE verifier, user binding, org binding", () => {
    for (const provider of ["twitch", "youtube", "kick"] as const) {
      const route = src(`src/app/api/auth/${provider}/callback/route.ts`);
      expect(route).toContain("verifyState");
      expect(route).toContain("State mismatch");
      expect(route).toContain("Missing verifier");
      expect(route).toContain("User mismatch");
      expect(route).toContain("Organization mismatch");
      expect(route).toContain("isSafeRedirect");
    }
  });
});

describe(".env.example — provider configuration documented", () => {
  const env = src(".env.example");

  it("documents every required variable name", () => {
    for (const name of [
      "TWITCH_CLIENT_ID",
      "TWITCH_CLIENT_SECRET",
      "YOUTUBE_CLIENT_ID",
      "YOUTUBE_CLIENT_SECRET",
      "YOUTUBE_API_KEY",
      "KICK_CLIENT_ID",
      "KICK_CLIENT_SECRET",
      "CREDENTIALS_ENCRYPTION_KEY",
      "NEXT_PUBLIC_APP_URL",
    ]) {
      expect(env).toContain(name);
    }
  });

  it("documents provider redirect URIs with actual callback paths", () => {
    expect(env).toContain("/api/auth/twitch/callback");
    expect(env).toContain("/api/auth/youtube/callback");
    expect(env).toContain("/api/auth/kick/callback");
    expect(env.toLowerCase()).not.toContain("coming soon");
  });

  it("contains no secrets", () => {
    expect(env).not.toMatch(/sk_live|whsec_live|rzp_live/);
  });
});
