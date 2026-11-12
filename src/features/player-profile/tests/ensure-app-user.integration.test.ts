// G1-1 authenticated integration tests (12 §2).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/cleanup below (12 §6). Run: `npm run test:integration`.
// Fail closed: without G1_TEST_MODE=g1-1 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY rows/users created by this
// run (exact tracked ids). Never truncate, never reset, never touch
// non-test records.
//
// NOTE: creating `g1t1_*` auth users + app_users rows and deleting them
// afterwards is an intentional, authorized write to the single project
// (Phase 9 rules). No other writes occur.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import { ensureAppUser } from "../server/ensure-app-user";

const ENABLED = process.env.G1_TEST_MODE === "g1-1";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t1_${Date.now().toString(36)}`;
const emailFor = (who: "a" | "b") => `${RUN_ID}_${who}@example.com`;
const PASSWORD = `T3st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

function anonClient(): SupabaseClient {
  return createClient(URL, ANON);
}

function authedClient(accessToken: string): SupabaseClient {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const trackedUserIds: string[] = [];
let tokenA = "";
let tokenB = "";
let idA = "";
let idB = "";

async function signUpIdentity(
  anon: SupabaseClient,
  email: string,
): Promise<{ id: string; accessToken: string }> {
  const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`BLOCKED: signUp failed: ${error.message}`);
  let session = data.session;
  if (!session) {
    // Confirmations may be on: try an explicit sign-in before giving up.
    const retry = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (retry.error || !retry.data.session) {
      throw new Error(
        "BLOCKED: no session issued (email confirmation likely required); cannot establish isolated test identities without weakening security.",
      );
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "ensureAppUser integration (G1-1, real RLS)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(anon, emailFor("a")));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(anon, emailFor("b")));
    }, 120_000);

    afterAll(async () => {
      // Best-effort, ownership-verified cleanup: only tracked ids, exact match.
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      for (const uid of trackedUserIds) {
        await admin.from("app_users").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }, 120_000);

    it("creates no app_users row at signup (onboarding required)", async () => {
      const admin = adminClient();
      const { data, error } = await admin
        .from("app_users")
        .select("id")
        .in("id", [idA, idB]);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it("first action creates exactly one row; second call is idempotent", async () => {
      const client = authedClient(tokenA);
      const first = await ensureAppUser(client);
      expect(first).toEqual({ id: idA, status: "active" });
      const second = await ensureAppUser(client);
      expect(second).toEqual(first);
      const admin = adminClient();
      const { data, error } = await admin
        .from("app_users")
        .select("id")
        .eq("id", idA);
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(1);
    });

    it("concurrent bootstrap converges on one row", async () => {
      const client = authedClient(tokenB);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => ensureAppUser(client)),
      );
      for (const r of results) expect(r).toEqual({ id: idB, status: "active" });
      const admin = adminClient();
      const { data, error } = await admin
        .from("app_users")
        .select("id")
        .eq("id", idB);
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(1);
    });

    it("a caller cannot bootstrap another user's identity", async () => {
      const clientA = authedClient(tokenA);
      const { error } = await clientA
        .from("app_users")
        .insert({ id: idB });
      expect(error).not.toBeNull();
      // B's row still belongs to B alone.
      const admin = adminClient();
      const { data } = await admin
        .from("app_users")
        .select("id")
        .eq("id", idB);
      expect((data ?? []).length).toBe(1);
    });

    it("non-owner and anonymous base SELECTs return nothing", async () => {
      const clientA = authedClient(tokenA);
      const other = await clientA.from("app_users").select("id").eq("id", idB);
      expect(other.error).toBeNull();
      expect(other.data ?? []).toEqual([]);

      const anon = anonClient();
      const anonRead = await anon.from("app_users").select("id").eq("id", idA);
      expect(anonRead.data ?? []).toEqual([]);
    });

    it("owner UPDATE and owner DELETE are denied", async () => {
      const clientA = authedClient(tokenA);
      // UPDATE is denied at the GRANT layer (D-G1-02 tightening): Postgres
      // checks table privileges before RLS, so this surfaces as 42501.
      const upd = await clientA
        .from("app_users")
        .update({ status: "suspended" })
        .eq("id", idA);
      expect(upd.error).not.toBeNull();

      // DELETE has a GRANT but no RLS policy, so RLS default-deny applies:
      // zero rows affected. PostgREST reports that as a success-shape with
      // no data (not a driver error). The property that matters — the row
      // survives untouched — is verified with a privileged read below.
      const del = await clientA.from("app_users").delete().eq("id", idA);
      expect(del.data ?? null).toBeNull();

      // Row untouched and still active.
      const admin = adminClient();
      const { data } = await admin
        .from("app_users")
        .select("status")
        .eq("id", idA);
      expect(data?.[0]?.status).toBe("active");
    });

    it("anonymous bootstrap is rejected", async () => {
      const anon = anonClient();
      // DB layer: EXECUTE revoked from anon.
      const { error } = await anon.rpc("ensure_app_user");
      expect(error).not.toBeNull();
      // App layer: no verified session -> 401-equivalent (07 §5).
      await expect(ensureAppUser(anon)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
    });

    it("unauthenticated operation is rejected", async () => {
      await expect(ensureAppUser(anonClient())).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
    });

    it("suspended accounts cannot pass bootstrap (generic error)", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idB);
      expect(susp.error).toBeNull();

      const failure = await ensureAppUser(authedClient(tokenB)).catch(
        (e: unknown) => e,
      );
      expect(failure).toBeInstanceOf(SuspendedError);
      expect((failure as Error).message).not.toContain(idB);
    });
  },
);
