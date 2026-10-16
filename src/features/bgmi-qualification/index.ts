export type { ScoringPreset, QualificationScenario, QualificationInput, CompareResult, QualificationShareState } from "./types";
export { QUALIFICATION_SHARE_VERSION } from "./types";
export { KRAFTON_2026_PRESET, QUALIFICATION_PRESETS, getPresetById } from "./services/presets";
export {
  BEST_CASE_POINTS_PER_MATCH,
  WORST_CASE_POINTS_PER_MATCH,
  BEST_CASE_ASSUMPTION,
  WORST_CASE_ASSUMPTION,
} from "./services/presets";
export {
  MAX_POINTS,
  MAX_MATCHES,
  isValidPoints,
  isValidMatches,
  isValidPlacement,
  isValidFinishes,
  placementPoints,
  scenarioPoints,
  pointsGap,
  requiredRate,
  projectedTotal,
  averageProjection,
  compareToTarget,
  planningBand,
  isOutOfReachUnderAssumptions,
} from "./services/scoring";
export type { ScenarioPoints, PlanningBand } from "./services/scoring";
export { verdictLabel, gapMessage, rateMessage, scenarioMessage, outOfReachMessage } from "./services/copy";
export { encodeShareState, decodeShareState, buildShareUrl } from "./services/share";
export type { DecodeResult } from "./services/share";
export { buildQualificationWhatsAppMessage, buildQualificationWhatsAppUrl } from "./services/whatsapp";
export type { WhatsAppCheckInput } from "./services/whatsapp";
