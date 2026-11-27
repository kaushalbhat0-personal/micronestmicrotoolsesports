// Profile onboarding server actions (P14-D12).
// Thin orchestration: session client → G1 create RPCs → revalidate.
// No service-role, no caller user IDs, no verification claims.

"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { SuspendedError, UnauthenticatedError } from "@/features/player-profile/domain/app-user";
import {
  GameProfileAlreadyExistsError,
  MissingPlayerProfileError,
  UnsupportedGameError,
} from "@/features/player-profile/domain/game-profile";
import {
  HandleTakenError,
  ProfileAlreadyExistsError,
  ProfileValidationError,
} from "@/features/player-profile/domain/player-profile";
import { createGameProfile } from "@/features/player-profile/server/game-profile";
import { createPlayerProfile } from "@/features/player-profile/server/player-profile";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingActionState {
  ok: boolean;
  message: string;
}

function mapError(error: unknown): OnboardingActionState {
  if (error instanceof UnauthenticatedError) {
    return { ok: false, message: "Sign in to create your profile." };
  }
  if (error instanceof SuspendedError) {
    return {
      ok: false,
      message: "Your account is suspended. Contact support to restore access.",
    };
  }
  if (error instanceof HandleTakenError) {
    return { ok: false, message: "This handle is already taken. Choose another." };
  }
  if (error instanceof ProfileAlreadyExistsError) {
    return { ok: false, message: "You already have a player profile." };
  }
  if (error instanceof ProfileValidationError) {
    return { ok: false, message: "Check your profile fields and try again." };
  }
  if (error instanceof GameProfileAlreadyExistsError) {
    return { ok: false, message: "You already added that game profile." };
  }
  if (error instanceof MissingPlayerProfileError) {
    return { ok: false, message: "Create your player profile first." };
  }
  if (error instanceof UnsupportedGameError) {
    return { ok: false, message: "That game is not available right now." };
  }
  if (error instanceof ZodError) {
    return { ok: false, message: "Check the highlighted fields and try again." };
  }
  return { ok: false, message: "Could not save your profile. Please try again." };
}

export async function completeProfileOnboardingAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const handle = String(formData.get("handle") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const countryRaw = String(formData.get("country_code") ?? "").trim().toUpperCase();
  const gameKey = String(formData.get("game_key") ?? "").trim().toLowerCase();
  const ign = String(formData.get("ign") ?? "").trim();
  const primaryRoleRaw = String(formData.get("primary_role") ?? "").trim();
  const regionRaw = String(formData.get("region_code") ?? "").trim().toLowerCase();
  const playModes = formData
    .getAll("play_modes")
    .map((v) => String(v).trim().toLowerCase())
    .filter((v) => v.length > 0);

  const client = await createClient();

  try {
    await createPlayerProfile(client, {
      handle,
      display_name: displayName,
      ...(bioRaw.length > 0 ? { bio: bioRaw } : {}),
      ...(countryRaw.length > 0 ? { country_code: countryRaw } : {}),
    });
  } catch (error) {
    if (!(error instanceof ProfileAlreadyExistsError)) {
      return mapError(error);
    }
    // Resume path: profile already exists — continue to game profile.
  }

  try {
    await createGameProfile(client, {
      game_key: gameKey || "bgmi",
      ign,
      ...(primaryRoleRaw.length > 0 ? { primary_role: primaryRoleRaw } : {}),
      ...(playModes.length > 0 ? { play_modes: playModes } : {}),
      ...(regionRaw.length > 0 ? { region_code: regionRaw } : {}),
    });
  } catch (error) {
    if (!(error instanceof GameProfileAlreadyExistsError)) {
      return mapError(error);
    }
  }

  revalidatePath("/onboarding/profile");
  revalidatePath("/settings/profile");
  revalidatePath("/players");
  revalidatePath("/workspace/teams");
  redirect("/settings/profile" as Route);
}
