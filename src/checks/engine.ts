import { assertRuntimeContract, CheckResult } from "../contracts/runtime";
import { CheckContext, CheckDefinition } from "./types";

function normalizeResult(
  profile: string,
  check: CheckDefinition,
  raw: Awaited<ReturnType<CheckDefinition["run"]>>
): CheckResult {
  return {
    check_id: check.id,
    profile,
    status: raw.status,
    severity_class: check.severity_class,
    reason_code: raw.reason_code,
    details: raw.details,
    evidence: raw.evidence,
    degradation: raw.degradation,
    source: raw.source
  };
}

export async function runCheckLifecycle(
  context: CheckContext,
  checks: CheckDefinition[]
): Promise<CheckResult[]> {
  const deterministicFirst = [...checks].sort((a, b) => {
    if (a.deterministic === b.deterministic) {
      return 0;
    }
    return a.deterministic ? -1 : 1;
  });

  const results: CheckResult[] = [];
  for (const check of deterministicFirst) {
    const raw = await check.run(context);
    const normalized = normalizeResult(context.options.profile, check, raw);
    assertRuntimeContract(normalized);
    results.push(normalized);
  }
  return results;
}
