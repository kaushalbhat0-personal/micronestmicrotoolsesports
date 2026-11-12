// Re-export feature parsers for workspace route tests and thin orchestration.
export {
  parseCreateTeamForm,
  parseUpdateTeamSettingsForm,
  type ParsedWorkspaceForm,
} from "@/features/teams/server/form-parsers";
