export type EvaluationResult =
  | "PASS"
  | "FAIL"
  | "NOT_VERIFIABLE"
  | "PENDING"
  | "NOT_SUPPORTED";

export const EVALUATION_RESULTS: readonly EvaluationResult[] = [
  "PASS",
  "FAIL",
  "NOT_VERIFIABLE",
  "PENDING",
  "NOT_SUPPORTED",
] as const;

export function isEvaluationResult(value: unknown): value is EvaluationResult {
  return (
    value === "PASS" ||
    value === "FAIL" ||
    value === "NOT_VERIFIABLE" ||
    value === "PENDING" ||
    value === "NOT_SUPPORTED"
  );
}

export interface EvaluationOutcome {
  readonly result: EvaluationResult;
  readonly reason: string;
}
