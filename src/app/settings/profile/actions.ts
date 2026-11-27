// Owner settings server actions (G1-7).
// Thin orchestration only: establish session client, call the narrow
// session-bound server operation, revalidate affected routes. No raw queries,
// no identity parameters, no service-role. All mutations require explicit
// owner intent (forms with confirmation); whole-account deletion is not
// offered here or anywhere in G1.

"use server";

import { revalidatePath } from "next/cache";
import { SuspendedError } from "@/features/player-profile/domain/app-user";
import {
  HandleCooldownError,
  HandleTakenError,
  ProfileIncompleteError,
  ProfileNotFoundError,
  ProfileValidationError,
} from "@/features/player-profile/domain/player-profile";
import {
  GameProfileNotFoundError,
  GameProfileValidationError,
  UnsupportedGameError,
} from "@/features/player-profile/domain/game-profile";
import {
  AvatarValidationError,
  AvatarOperationError,
} from "@/features/player-profile/domain/avatar";
import {
  BgmiOwnershipForbiddenError,
  BgmiOwnershipNotFoundError,
  BgmiOwnershipOperationError,
  BgmiOwnershipRateLimitError,
  BgmiOwnershipValidationError,
  BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES,
} from "@/features/player-profile/domain/bgmi-ownership";
import {
  getDiscoverabilityState,
  setDiscoverability,
} from "@/features/player-profile/server/consent";
import { updateHandle } from "@/features/player-profile/server/handle";
import { updatePlayerProfile } from "@/features/player-profile/server/player-profile";
import { updateGameProfile } from "@/features/player-profile/server/game-profile";
import { removeAvatar, uploadAvatar } from "@/features/player-profile/server/avatar";
import {
  deletePlayerProfile,
  removeGameProfile,
} from "@/features/player-profile/server/deletion";
import { setGameProfileVisibility } from "@/features/player-profile/server/game-visibility";
import {
  createBgmiOwnershipDraftCase,
  mintBgmiOwnershipEvidenceSignedUrl,
  submitBgmiOwnershipCase,
  uploadBgmiOwnershipEvidence,
  withdrawBgmiOwnershipCase,
} from "@/features/player-profile/server/bgmi-ownership";
import {
  BGMI_PLAY_MODES,
  BGMI_ROLES,
  BGMI_REGION_VOCABULARY,
  normalizeGameUserIdInput,
} from "@/features/player-profile/schemas/game";
import { AVATAR_ALLOWED_MIMES, AVATAR_MAX_BYTES } from "@/features/player-profile/schemas/avatar";
import { BGMI_OWNERSHIP_ALLOWED_MIME } from "@/features/player-profile/schemas/bgmi-ownership";
import { createClient } from "@/lib/supabase/server";

export interface SettingsActionState {
  ok: boolean;
  message: string;
}

function toSettingsState(error: unknown, fallback: string): SettingsActionState {
  if (error instanceof SuspendedError) {
    return {
      ok: false,
      message: "Your account is suspended. Contact support to restore access.",
    };
  }
  return { ok: false, message: fallback };
}

function revalidateSettingsAndPublic(handle?: string): void {
  revalidatePath("/settings/profile");
  revalidatePath("/players");
  if (handle !== undefined) {
    revalidatePath(`/players/${handle}`);
  }
}

export async function getSettingsSnapshot(): Promise<{
  signedIn: boolean;
  discoverable: boolean | null;
}> {
  const client = await createClient();
  try {
    const state = await getDiscoverabilityState(client);
    return { signedIn: true, discoverable: state.is_discoverable };
  } catch {
    return { signedIn: false, discoverable: null };
  }
}

export async function setDiscoverabilityAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const raw = formData.get("is_discoverable");
  if (raw !== "true" && raw !== "false") {
    return { ok: false, message: "Choose discoverable on or off, then save." };
  }
  const client = await createClient();
  try {
    const profile = await setDiscoverability(client, {
      is_discoverable: raw === "true",
    });
    revalidateSettingsAndPublic(profile.handle);
    return {
      ok: true,
      message:
        raw === "true"
          ? "Discoverability enabled. Your visible game profiles can now appear in the public directory while your profile stays complete."
          : "Discoverability disabled. Your profile is no longer returned by public discovery. Your choice is saved.",
    };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    if (error instanceof ProfileIncompleteError) {
      return { ok: false, message: error.message };
    }
    return toSettingsState(error, "Could not save discoverability. Please retry.");
  }
}

export async function updateProfileDetailsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const displayName = formData.get("display_name");
  const bioRaw = formData.get("bio");
  const countryRaw = formData.get("country_code");
  if (typeof displayName !== "string") {
    return { ok: false, message: "Enter a display name, then save." };
  }
  const bio =
    typeof bioRaw === "string" ? (bioRaw.trim().length === 0 ? null : bioRaw) : null;
  const country =
    typeof countryRaw === "string"
      ? countryRaw.trim().length === 0
        ? null
        : countryRaw.trim().toUpperCase()
      : null;

  const client = await createClient();
  try {
    const profile = await updatePlayerProfile(client, {
      display_name: displayName,
      bio,
      country_code: country,
    });
    revalidateSettingsAndPublic(profile.handle);
    return { ok: true, message: "Profile details saved." };
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return { ok: false, message: "Check display name, bio, and country, then retry." };
    }
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    return toSettingsState(error, "Could not save profile details. Please retry.");
  }
}

export async function updateGameDetailsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const gameKey = formData.get("game_key");
  const ign = formData.get("ign");
  if (typeof gameKey !== "string" || typeof ign !== "string") {
    return { ok: false, message: "Game profile fields are incomplete." };
  }
  const roleRaw = formData.get("primary_role");
  const regionRaw = formData.get("region_code");
  const playModes = formData
    .getAll("play_modes")
    .filter((v): v is string => typeof v === "string");
  const availability = formData
    .getAll("availability")
    .filter((v): v is string => typeof v === "string");

  const primaryRole =
    typeof roleRaw === "string" && roleRaw.trim().length > 0 ? roleRaw.trim() : null;
  const regionCode =
    typeof regionRaw === "string" && regionRaw.trim().length > 0
      ? regionRaw.trim().toLowerCase()
      : null;

  // Reject unknown enum values early (defense in depth; Zod also validates).
  if (primaryRole !== null && !(BGMI_ROLES as readonly string[]).includes(primaryRole)) {
    return { ok: false, message: "Choose a valid primary role." };
  }
  if (
    regionCode !== null &&
    !(BGMI_REGION_VOCABULARY as readonly string[]).includes(regionCode)
  ) {
    return { ok: false, message: "Choose a valid region." };
  }
  for (const mode of playModes) {
    if (!(BGMI_PLAY_MODES as readonly string[]).includes(mode)) {
      return { ok: false, message: "Choose valid play modes." };
    }
  }

  const client = await createClient();
  try {
    await updateGameProfile(client, gameKey, {
      ign,
      primary_role: primaryRole,
      region_code: regionCode,
      play_modes: playModes,
      availability,
      // Private BGMI Player ID is managed by updateBgmiPlayerIdAction (M2B.2).
    });
    revalidateSettingsAndPublic();
    return { ok: true, message: "Game profile saved." };
  } catch (error) {
    if (error instanceof GameProfileValidationError) {
      return { ok: false, message: "Check IGN, role, region, and play modes, then retry." };
    }
    if (error instanceof GameProfileNotFoundError) {
      return { ok: false, message: "Game profile not found." };
    }
    if (error instanceof UnsupportedGameError) {
      return { ok: false, message: "This game is not supported." };
    }
    return toSettingsState(error, "Could not save game profile. Please retry.");
  }
}

/**
 * Owner-only private BGMI Player ID (maps to player_game_profiles.game_user_id).
 * Never logs the identifier. Clear via intent=clear or empty input.
 */
export async function updateBgmiPlayerIdAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const gameKey = formData.get("game_key");
  if (typeof gameKey !== "string" || gameKey.trim().length === 0) {
    return { ok: false, message: "Game profile reference is missing." };
  }
  const intent = formData.get("intent");
  const clear = intent === "clear";
  const normalized = clear ? null : normalizeGameUserIdInput(formData.get("game_user_id"));
  if (!clear && normalized === undefined) {
    return { ok: false, message: "Enter a Player ID, or clear it." };
  }
  // Empty after trim → clear (product permits nullable column).
  const nextValue = clear || normalized === null ? null : normalized;

  const client = await createClient();
  try {
    await updateGameProfile(client, gameKey, { game_user_id: nextValue });
    revalidateSettingsAndPublic();
    return {
      ok: true,
      message:
        nextValue === null
          ? "BGMI Player ID cleared. It is not shown publicly."
          : "BGMI Player ID saved. It stays private to your account.",
    };
  } catch (error) {
    if (error instanceof GameProfileValidationError) {
      // Do not echo the submitted ID.
      return {
        ok: false,
        message: "That Player ID could not be saved. Use 4–32 characters without control characters.",
      };
    }
    if (error instanceof GameProfileNotFoundError) {
      return { ok: false, message: "Game profile not found." };
    }
    if (error instanceof UnsupportedGameError) {
      return { ok: false, message: "This game is not supported." };
    }
    return toSettingsState(error, "Could not save your Player ID. Please retry.");
  }
}

export async function uploadAvatarAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file (PNG, JPEG, or WebP)." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "Avatar must be 512 KB or smaller." };
  }
  const mimeType = file.type;
  if (!(AVATAR_ALLOWED_MIMES as readonly string[]).includes(mimeType)) {
    return { ok: false, message: "Avatar must be PNG, JPEG, or WebP." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const client = await createClient();
  try {
    const profile = await uploadAvatar(client, { bytes, mimeType });
    revalidateSettingsAndPublic(profile.handle);
    return { ok: true, message: "Avatar updated." };
  } catch (error) {
    if (error instanceof AvatarValidationError) {
      return { ok: false, message: "That image could not be accepted. Use PNG, JPEG, or WebP under 512 KB." };
    }
    if (error instanceof AvatarOperationError) {
      return { ok: false, message: "Could not upload the avatar. Please retry." };
    }
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    return toSettingsState(error, "Could not upload the avatar. Please retry.");
  }
}

export async function removeAvatarAction(
  _prev: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  const client = await createClient();
  try {
    const profile = await removeAvatar(client);
    revalidateSettingsAndPublic(profile.handle);
    return { ok: true, message: "Avatar removed." };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    return toSettingsState(error, "Could not remove the avatar. Please retry.");
  }
}

export async function setGameVisibilityAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const gameKey = formData.get("game_key");
  const raw = formData.get("is_visible");
  if (typeof gameKey !== "string" || (raw !== "true" && raw !== "false")) {
    return { ok: false, message: "Invalid visibility choice. Please retry." };
  }
  const client = await createClient();
  try {
    await setGameProfileVisibility(client, gameKey, {
      is_visible: raw === "true",
    });
    revalidateSettingsAndPublic();
    return {
      ok: true,
      message:
        raw === "true"
          ? "Game profile visibility enabled for this title."
          : "Game profile hidden for this title. It no longer appears in public discovery.",
    };
  } catch (error) {
    if (error instanceof GameProfileNotFoundError) {
      return { ok: false, message: "Game profile not found." };
    }
    if (error instanceof UnsupportedGameError) {
      return { ok: false, message: "This game is not supported." };
    }
    return toSettingsState(error, "Could not save game visibility. Please retry.");
  }
}

export async function updateHandleAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const raw = formData.get("handle");
  if (typeof raw !== "string") {
    return { ok: false, message: "Enter a handle, then save." };
  }
  const client = await createClient();
  try {
    const profile = await updateHandle(client, { handle: raw });
    revalidateSettingsAndPublic(profile.handle);
    return { ok: true, message: `Handle changed to ${profile.handle}.` };
  } catch (error) {
    if (error instanceof HandleCooldownError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof HandleTakenError) {
      return { ok: false, message: "This handle is already taken." };
    }
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    return toSettingsState(error, "Could not change your handle. Please retry.");
  }
}

export async function removeGameProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const gameKey = formData.get("game_key");
  const confirm = formData.get("confirm");
  if (typeof gameKey !== "string" || confirm !== "yes") {
    return {
      ok: false,
      message: "Confirm removal of this game profile, then submit.",
    };
  }
  const client = await createClient();
  try {
    await removeGameProfile(client, gameKey);
    revalidateSettingsAndPublic();
    return { ok: true, message: "Game profile removed." };
  } catch (error) {
    if (error instanceof GameProfileNotFoundError) {
      return { ok: false, message: "Game profile not found." };
    }
    return toSettingsState(error, "Could not remove the game profile. Please retry.");
  }
}

export async function deletePlayerProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const confirmHandle = formData.get("confirm_handle");
  const confirm = formData.get("confirm");
  if (typeof confirmHandle !== "string" || confirmHandle.trim().length === 0) {
    return {
      ok: false,
      message: "Type your handle to confirm deletion.",
    };
  }
  if (confirm !== "yes") {
    return {
      ok: false,
      message: "Tick the confirmation checkbox to delete your player profile.",
    };
  }
  const client = await createClient();
  try {
    const { getOwnProfile } = await import(
      "@/features/player-profile/server/player-profile"
    );
    const own = await getOwnProfile(client);
    if (own === null) {
      return { ok: false, message: "Create your player profile first." };
    }
    if (own.handle.toLowerCase() !== confirmHandle.trim().toLowerCase()) {
      return {
        ok: false,
        message: "The typed handle does not match your profile handle.",
      };
    }
    await deletePlayerProfile(client);
    revalidateSettingsAndPublic(own.handle);
    return {
      ok: true,
      message:
        "Your player profile and associated game profiles were deleted. Your login is unchanged.",
    };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Player profile not found." };
    }
    return toSettingsState(
      error,
      "Could not delete your player profile. Please retry.",
    );
  }
}

function toBgmiOwnershipState(error: unknown, fallback: string): SettingsActionState {
  if (error instanceof BgmiOwnershipRateLimitError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof BgmiOwnershipValidationError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof BgmiOwnershipNotFoundError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof BgmiOwnershipForbiddenError) {
    return { ok: false, message: "Not allowed." };
  }
  if (error instanceof BgmiOwnershipOperationError) {
    return { ok: false, message: fallback };
  }
  return toSettingsState(error, fallback);
}

/** Start a draft ownership case (server snapshots ID only on submit). */
export async function createBgmiOwnershipDraftAction(
  _prev: SettingsActionState,
  _formData: FormData,
): Promise<SettingsActionState> {
  const client = await createClient();
  try {
    await createBgmiOwnershipDraftCase(client);
    revalidatePath("/settings/profile");
    return { ok: true, message: "Draft started. Add one or two screenshots, then submit." };
  } catch (error) {
    return toBgmiOwnershipState(error, "Could not start verification. Please retry.");
  }
}

/** Upload one sanitized evidence image into the owner's draft case. */
export async function uploadBgmiOwnershipEvidenceAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const caseId = formData.get("case_id");
  const file = formData.get("evidence");
  if (typeof caseId !== "string" || caseId.length === 0) {
    return { ok: false, message: "Verification case is missing." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a JPEG, PNG, or WebP screenshot." };
  }
  if (file.size > BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES) {
    return { ok: false, message: "Each screenshot must be 5 MB or smaller." };
  }
  if (!(BGMI_OWNERSHIP_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    // UX-only hint; server re-validates magic bytes.
    return { ok: false, message: "Use JPEG, PNG, or WebP only." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const client = await createClient();
  try {
    await uploadBgmiOwnershipEvidence(client, { caseId, bytes });
    revalidatePath("/settings/profile");
    return { ok: true, message: "Screenshot uploaded." };
  } catch (error) {
    return toBgmiOwnershipState(
      error,
      "Could not upload that screenshot. Please retry with a different image.",
    );
  }
}

/** Confirm draft → pending_review (server captures claimed_game_user_id). */
export async function submitBgmiOwnershipCaseAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const caseId = formData.get("case_id");
  if (typeof caseId !== "string" || caseId.length === 0) {
    return { ok: false, message: "Verification case is missing." };
  }
  const confirmed = formData.get("confirm");
  if (confirmed !== "yes") {
    return {
      ok: false,
      message: "Confirm that you understand evidence cannot be replaced while pending.",
    };
  }
  const client = await createClient();
  try {
    await submitBgmiOwnershipCase(client, caseId);
    revalidatePath("/settings/profile");
    return {
      ok: true,
      message: "Submitted for manual review. You can withdraw and resubmit if needed.",
    };
  } catch (error) {
    return toBgmiOwnershipState(error, "Could not submit verification. Please retry.");
  }
}

/** Owner withdraw — deletes evidence objects via trusted lifecycle. */
export async function withdrawBgmiOwnershipCaseAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const caseId = formData.get("case_id");
  if (typeof caseId !== "string" || caseId.length === 0) {
    return { ok: false, message: "Verification case is missing." };
  }
  const client = await createClient();
  try {
    const result = await withdrawBgmiOwnershipCase(client, caseId);
    revalidatePath("/settings/profile");
    if (result.storageDeleteFailures > 0) {
      return {
        ok: false,
        message:
          "Withdrawal was recorded, but some evidence files could not be deleted. Retry withdrawal.",
      };
    }
    return {
      ok: true,
      message: result.alreadyWithdrawn
        ? "This submission was already withdrawn."
        : "Submission withdrawn. Evidence files were deleted. You can start a new submission.",
    };
  } catch (error) {
    return toBgmiOwnershipState(error, "Could not withdraw this submission. Please retry.");
  }
}

/** Owner-only short-lived preview URL (60s). Never logs the URL. */
export async function mintBgmiOwnershipPreviewUrlAction(
  caseId: string,
  evidenceId: string,
): Promise<{ ok: true; url: string; expiresIn: number } | { ok: false; message: string }> {
  const client = await createClient();
  try {
    const minted = await mintBgmiOwnershipEvidenceSignedUrl(client, {
      caseId,
      evidenceId,
    });
    return { ok: true, url: minted.signedUrl, expiresIn: minted.expiresIn };
  } catch (error) {
    const state = toBgmiOwnershipState(error, "Could not open preview.");
    return { ok: false, message: state.message };
  }
}
