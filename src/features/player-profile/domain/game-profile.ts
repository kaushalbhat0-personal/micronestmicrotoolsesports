// Player game profile contract (G1-3).
// Authoritative: 03 sections 3/5, 05 section 1, 07 section 1/3
// (upsertGameProfile/removeGameProfile), 11 section 3 (D-G1-09).
// One row per (player, game). All fields self-declared; G1 stores no
// verification status, ranks, scores, K/D or badges. game_user_id is
// owner-private; its projection treatment stays OPEN under D-G1-04.

export interface GameProfile {
  id: string;
  player_user_id: string;
  game_key: string;
  ign: string;
  game_user_id: string | null;
  primary_role: string | null;
  play_modes: string[];
  region_code: string | null;
  availability: string[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameCatalogueEntry {
  key: string;
  name: string;
  short_name: string;
}

// Domain errors (07 section 3: repositories throw domain errors, never raw
// PostgREST errors to UI). Messages are generic by design (08 T5/T8).

export class GameProfileAlreadyExistsError extends Error {
  constructor() {
    super("You already have a profile for this game.");
    this.name = "GameProfileAlreadyExistsError";
  }
}

export class GameProfileNotFoundError extends Error {
  constructor() {
    super("Game profile not found.");
    this.name = "GameProfileNotFoundError";
  }
}

export class UnsupportedGameError extends Error {
  constructor() {
    super("This game is not supported.");
    this.name = "UnsupportedGameError";
  }
}

export class MissingPlayerProfileError extends Error {
  constructor() {
    super("Create your player profile first.");
    this.name = "MissingPlayerProfileError";
  }
}

export class GameProfileValidationError extends Error {
  constructor() {
    super("Invalid game profile data.");
    this.name = "GameProfileValidationError";
  }
}

export class GameProfileOperationError extends Error {
  constructor() {
    super("Could not save your game profile. Please retry.");
    this.name = "GameProfileOperationError";
  }
}
