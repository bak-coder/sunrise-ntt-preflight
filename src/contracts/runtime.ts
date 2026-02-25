export type RuntimeStatus = "PASS" | "FAIL" | "SKIPPED";

export type SeverityClass = "blocking" | "non-blocking";

export interface CheckEvidence {
  summary: string;
  data?: Record<string, unknown>;
}

export interface CheckResult {
  check_id: string;
  profile: string;
  status: RuntimeStatus;
  severity_class: SeverityClass;
  reason_code: string | null;
  details: string;
  evidence: CheckEvidence;
  degradation: boolean;
  source: string;
}

export class ContractViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractViolationError";
  }
}

export function assertRuntimeContract(result: CheckResult): void {
  if (result.severity_class === "non-blocking" && result.status === "FAIL") {
    throw new ContractViolationError(
      `Invalid result for ${result.check_id}: non-blocking + FAIL is not allowed`
    );
  }

  if (result.status === "SKIPPED" && !result.reason_code) {
    throw new ContractViolationError(
      `Invalid result for ${result.check_id}: SKIPPED requires reason_code`
    );
  }

  if (result.status === "SKIPPED" && result.details.trim().length === 0) {
    throw new ContractViolationError(
      `Invalid result for ${result.check_id}: SKIPPED requires details`
    );
  }

  if (result.status === "PASS" && result.degradation) {
    throw new ContractViolationError(
      `Invalid result for ${result.check_id}: PASS with degradation=true is not allowed`
    );
  }
}
