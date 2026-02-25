import { CheckResult } from "./runtime";

export interface VerifyReport {
  generated_at: string;
  profile: string;
  fail_on: "blocking" | "all" | "none";
  summary: {
    pass: number;
    fail: number;
    skipped: number;
    total: number;
    ci_should_fail: boolean;
  };
  results: CheckResult[];
}

export interface TxPlanStep {
  id: string;
  description: string;
  requires_signature: boolean;
}

export interface TxPlan {
  generated_at: string;
  profile: string;
  assumptions: string[];
  steps: TxPlanStep[];
}
