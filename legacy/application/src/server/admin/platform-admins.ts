import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/server/admin/audit";

/**
 * Platform admin membership — removes the raw-SQL-only dependency.
 * requireSuperAdmin → createAdminClient → bounded op → recordAdminAudit.
 * Lockout protection is server-side AND atomic: revoke runs inside the
 * revoke_platform_admin_atomic RPC (LOCK TABLE + check + delete in one
 * transaction), so concurrent revokes can never yield zero platform admins.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlatformAdminItem {
  userId: string;
  email: string | null;
  displayName: string | null;
  grantedAt: string;
  grantedBy: string | null;
  grantedByEmail: string | null;
  reason: string | null;
}

function requireReason(reason: string): string {
  const r = reason.trim().slice(0, 500);
  if (r.length < 5) throw new Error("A reason of at least 5 characters is required");
  return r;
}

export async function listPlatformAdmins(): Promise<{ admins: PlatformAdminItem[]; error?: string }> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("platform_admins")
      .select("user_id, granted_by, granted_at, reason")
      .order("granted_at", { ascending: true });
    if (error) throw error;
    const rows = ((data ?? []) as Array<{ user_id: string; granted_by: string | null; granted_at: string; reason: string | null }>);
    const userIds = [...new Set([...rows.map((r) => r.user_id), ...rows.map((r) => r.granted_by).filter((v): v is string => Boolean(v))])];
    const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, email, display_name").in("id", userIds);
      for (const p of ((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>)) {
        profileMap.set(p.id, p);
      }
    }
    return {
      admins: rows.map((r) => ({
        userId: r.user_id,
        email: profileMap.get(r.user_id)?.email ?? null,
        displayName: profileMap.get(r.user_id)?.display_name ?? null,
        grantedAt: r.granted_at,
        grantedBy: r.granted_by,
        grantedByEmail: r.granted_by ? (profileMap.get(r.granted_by)?.email ?? null) : null,
        reason: r.reason,
      })),
    };
  } catch {
    return { admins: [], error: "Unable to load platform admins." };
  }
}

export async function grantPlatformAdmin(
  userId: string,
  reason: string,
): Promise<{ ok: true; idempotent: boolean } | { ok: false; error: string }> {
  try {
    const actor = await requireSuperAdmin();
    if (!UUID_RE.test(userId)) return { ok: false, error: "Invalid user ID" };
    let cleanReason: string;
    try {
      cleanReason = requireReason(reason);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Reason required" };
    }
    const admin = createAdminClient();

    // Eligible existing user — profiles only, never auth.users, never auto-promote
    const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!profile) return { ok: false, error: "User not found" };

    // Idempotent duplicate prevention
    const { data: existing } = await admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (existing) return { ok: true, idempotent: true };

    const { error } = await admin.from("platform_admins").insert({ user_id: userId, granted_by: actor.id, reason: cleanReason });
    if (error) {
      // Unique violation race → treat as idempotent success
      if (error.code === "23505") return { ok: true, idempotent: true };
      return { ok: false, error: "Failed to grant platform admin" };
    }

    await recordAdminAudit({
      action: "platform_admin.grant",
      targetType: "platform_admin",
      targetId: userId,
      reason: cleanReason,
      before: { isAdmin: false },
      after: { isAdmin: true },
    });
    return { ok: true, idempotent: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to grant platform admin" };
  }
}

export async function revokePlatformAdmin(
  userId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
    if (!UUID_RE.test(userId)) return { ok: false, error: "Invalid user ID" };
    let cleanReason: string;
    try {
      cleanReason = requireReason(reason);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Reason required" };
    }
    const admin = createAdminClient();

    // Atomic revoke: existence check, final-admin count, and delete run
    // inside a single RPC transaction (LOCK TABLE serialises concurrent
    // revokes). The pre-RPC read is only for a fast, truthful "not found"
    // without invoking the RPC — the RPC re-checks authoritatively.
    const { data: rpcData, error: rpcError } = await admin.rpc("revoke_platform_admin_atomic", {
      p_target: userId,
    });
    if (rpcError) return { ok: false, error: "Failed to revoke platform admin" };
    const result = rpcData as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      if (result?.error === "not_found") return { ok: false, error: "Platform admin not found" };
      if (result?.error === "final_admin") {
        return { ok: false, error: "Cannot revoke the final platform admin — grant another admin first" };
      }
      return { ok: false, error: "Failed to revoke platform admin" };
    }

    await recordAdminAudit({
      action: "platform_admin.revoke",
      targetType: "platform_admin",
      targetId: userId,
      reason: cleanReason,
      before: { isAdmin: true },
      after: { isAdmin: false },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revoke platform admin" };
  }
}
