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
  ProfileNotFoundError,
} from "@/features/player-profile/domain/player-profile";
import {
  GameProfileNotFoundError,
  UnsupportedGameError,
} from "@/features/player-profile/domain/game-profile";
import {
  getDiscoverabilityState,
  setDiscoverability,
} from "@/features/player-profile/server/consent";
import { updateHandle } from "@/features/player-profile/server/handle";
import {
  deletePlayerProfile,
  removeGameProfile,
} from "@/features/player-profile/server/deletion";
import { setGameProfileVisibility } from "@/features/player-profile/server/game-visibility";
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
          ? "Discoverability enabled. Your visible game profiles can now appear in the public directory."
          : "Discoverability disabled. Your profile is no longer returned by public discovery.",
    };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return { ok: false, message: "Create your player profile first." };
    }
    return toSettingsState(error, "Could not save discoverability. Please retry.");
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
