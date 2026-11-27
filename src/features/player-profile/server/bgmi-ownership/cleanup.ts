// Owner-authorized BGMI ownership evidence cleanup for profile deletion.
// Withdraws active cases (clears evidence metadata + claim), then deletes
// Storage objects. Preserves withdrawn case rows as minimal audit.
// Never reports success when Storage removals fail.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BGMI_OWNERSHIP_BUCKET,
  BGMI_OWNERSHIP_PATH_PREFIX,
  BgmiOwnershipOperationError,
} from "../../domain/bgmi-ownership";
import { ensureAppUser } from "../ensure-app-user";

export interface BgmiOwnershipCleanupResult {
  casesWithdrawn: number;
  objectsAttempted: number;
  storageDeleteFailures: number;
}

async function getSessionUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new BgmiOwnershipOperationError();
  }
  return user.id;
}

/**
 * Removes the caller's ownership evidence objects via the withdraw lifecycle.
 * Retains withdrawn case rows (status + timestamps only). Idempotent.
 */
export async function cleanupOwnBgmiOwnershipEvidence(
  client: SupabaseClient,
): Promise<BgmiOwnershipCleanupResult> {
  const ownerId = await getSessionUserId(client);
  await ensureAppUser(client);

  const { data: activeCases, error: casesError } = await client
    .from("player_bgmi_ownership_cases")
    .select("id,status")
    .eq("player_id", ownerId)
    .in("status", ["draft", "pending_review", "id_mismatch"]);

  if (casesError) {
    throw new BgmiOwnershipOperationError();
  }

  const paths: string[] = [];
  let casesWithdrawn = 0;

  for (const row of (activeCases ?? []) as Array<{ id: string }>) {
    const { data, error: withdrawError } = await client.rpc(
      "withdraw_player_bgmi_ownership_case",
      { p_case_id: row.id },
    );
    if (withdrawError) {
      throw new BgmiOwnershipOperationError();
    }
    casesWithdrawn += 1;
    for (const item of (data ?? []) as Array<{ storage_path: string }>) {
      if (
        typeof item.storage_path === "string" &&
        item.storage_path.startsWith(`${ownerId}/`)
      ) {
        paths.push(item.storage_path);
      }
    }
  }

  // Sweep any leftover objects under the owner bgmi-ownership prefix.
  const { data: caseFolders } = await client.storage
    .from(BGMI_OWNERSHIP_BUCKET)
    .list(`${ownerId}/${BGMI_OWNERSHIP_PATH_PREFIX}`, { limit: 100 });

  for (const folder of caseFolders ?? []) {
    if (!folder.name) continue;
    const prefix = `${ownerId}/${BGMI_OWNERSHIP_PATH_PREFIX}/${folder.name}`;
    const { data: files } = await client.storage
      .from(BGMI_OWNERSHIP_BUCKET)
      .list(prefix, { limit: 20 });
    for (const file of files ?? []) {
      if (!file.name) continue;
      paths.push(`${prefix}/${file.name}`);
    }
  }

  const uniquePaths = Array.from(new Set(paths));
  if (uniquePaths.length === 0) {
    return {
      casesWithdrawn,
      objectsAttempted: 0,
      storageDeleteFailures: 0,
    };
  }

  const { error: removeError } = await client.storage
    .from(BGMI_OWNERSHIP_BUCKET)
    .remove(uniquePaths);

  if (removeError) {
    throw new BgmiOwnershipOperationError();
  }

  return {
    casesWithdrawn,
    objectsAttempted: uniquePaths.length,
    storageDeleteFailures: 0,
  };
}
