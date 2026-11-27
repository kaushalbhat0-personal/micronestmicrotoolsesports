// Team form parsing (P14-D3). Pure module: untrusted form records → strict writer contracts.

import {
  parseCreateTeamInput,
  parseUpdateTeamSettingsInput,
} from "@/features/teams/server/workspace-writer";
import { WorkspaceValidationError } from "@/features/teams/domain/workspace";

export interface ParsedWorkspaceForm {
  ok: boolean;
  value?: unknown;
  message?: string;
}

function readString(record: Record<string, unknown>, key: string): unknown {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readCheckbox(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (value === "true" || value === "on") {
    return true;
  }
  return false;
}

export function parseCreateTeamForm(record: Record<string, unknown>): ParsedWorkspaceForm {
  const candidate = {
    slug: readString(record, "slug"),
    name: readString(record, "name"),
    gameKey: readString(record, "gameKey"),
    regionCode: readString(record, "regionCode"),
    currentLevel: readString(record, "currentLevel"),
    targetLevel: readString(record, "targetLevel"),
    description: readString(record, "description") ?? undefined,
    recruiting: readCheckbox(record, "recruiting"),
    isPublic: readCheckbox(record, "isPublic"),
    ...(record["owner_user_id"] !== undefined ? { owner_user_id: record["owner_user_id"] } : {}),
    ...(record["created_by"] !== undefined ? { created_by: record["created_by"] } : {}),
    ...(record["organization_id"] !== undefined ? { organization_id: record["organization_id"] } : {}),
  };
  try {
    return { ok: true, value: parseCreateTeamInput(candidate) };
  } catch (error) {
    if (error instanceof WorkspaceValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    throw error;
  }
}

export function parseUpdateTeamSettingsForm(
  teamId: string,
  record: Record<string, unknown>,
): ParsedWorkspaceForm {
  const candidate = {
    teamId,
    patch: {
      name: readString(record, "name"),
      regionCode: readString(record, "regionCode"),
      currentLevel: readString(record, "currentLevel"),
      targetLevel: readString(record, "targetLevel"),
      description: readString(record, "description") ?? undefined,
      recruiting: readCheckbox(record, "recruiting"),
      isPublic: readCheckbox(record, "isPublic"),
      ...(record["slug"] !== undefined ? { slug: record["slug"] } : {}),
      ...(record["gameKey"] !== undefined ? { gameKey: record["gameKey"] } : {}),
      ...(record["owner_user_id"] !== undefined ? { owner_user_id: record["owner_user_id"] } : {}),
      ...(record["organization_id"] !== undefined ? { organization_id: record["organization_id"] } : {}),
    },
  };
  try {
    return { ok: true, value: parseUpdateTeamSettingsInput(candidate) };
  } catch (error) {
    if (error instanceof WorkspaceValidationError) {
      return { ok: false, message: "Check the highlighted fields and try again." };
    }
    throw error;
  }
}
