import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TxPlan } from "../contracts/output";
import { RuntimeOptions } from "../checks/types";
import { CheckResult } from "../contracts/runtime";

export function buildTxPlanSkeleton(options: RuntimeOptions): TxPlan {
  return {
    generated_at: new Date().toISOString(),
    profile: options.profile,
    assumptions: [
      "Scaffold baseline only: no transaction generation logic is implemented.",
      "Preflight mode is read-only and does not sign or execute transactions."
    ],
    steps: []
  };
}

function readObservedPair(result: CheckResult): string {
  const data = result.evidence.data ?? {};
  const observed = (data.observed as Record<string, unknown> | undefined) ?? {};
  const pair = observed.first_failing_pair ?? observed.checked_pair;
  return typeof pair === "string" ? pair : "unknown-pair";
}

function readObservedValue(result: CheckResult, key: string, fallback = "unknown"): string {
  const data = result.evidence.data ?? {};
  const observed = (data.observed as Record<string, unknown> | undefined) ?? {};
  const value = observed[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readEvidenceSummary(result: CheckResult): string {
  return result.evidence.summary ?? "No evidence summary provided.";
}

function buildActionStepsFromResults(results: CheckResult[]): TxPlan["steps"];
function buildActionStepsFromResults(results: CheckResult | CheckResult[]): TxPlan["steps"] {
  const list = Array.isArray(results) ? results : [results];
  const actionable = list.filter((result) => result.status === "FAIL");
  const steps: TxPlan["steps"] = [];

  for (const result of actionable) {
    if (result.check_id === "CHK-007-peer-registration-symmetry-mock") {
      const pair = readObservedPair(result);
      const rootCause = result.details;
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Fix peer-registration symmetry for ${pair}. Ensure both directional peer registrations exist before re-verify. ` +
          `Observed root cause: ${rootCause}. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: true
      });
    }

    if (result.check_id === "CHK-008-decimals-sync-mock") {
      const pair = readObservedPair(result);
      const rootCause = result.details;
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Align registration decimals for ${pair}. Update directional registrations to a consistent decimals value, then re-verify. ` +
          `Observed root cause: ${rootCause}. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: true
      });
    }

    if (result.check_id === "CHK-009-executor-endpoint-reachability") {
      const endpoint = readObservedValue(result, "endpoint");
      const requestUrl = readObservedValue(result, "request_url");
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Restore executor endpoint reachability for endpoint=${endpoint} (request_url=${requestUrl}). ` +
          `Verify base URL/health path, network egress, and endpoint HTTP availability, then re-verify. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: false
      });
    }

    if (result.check_id === "CHK-010-executor-relay-capabilities") {
      const requestUrl = readObservedValue(result, "request_url");
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Fix executor capabilities payload at ${requestUrl}. Ensure /v0/capabilities is reachable and returns minimal required fields ` +
          `(supported_chains:string[], supported_relay_types:string[], status:string), then re-verify. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: false
      });
    }

    if (result.check_id === "CHK-011-executor-transceiver-config-presence") {
      const requiredRef = readObservedValue(result, "required_reference");
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Fix executor transceiver config presence in ntt.json. Ensure executor.transceiverAddress/transceiverReference is set ` +
          `and included in executor.transceivers (required_reference=${requiredRef}), then re-verify. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: false
      });
    }

    if (result.check_id === "CHK-012-executor-quote-sanity") {
      const requestUrl = readObservedValue(result, "request_url");
      steps.push({
        id: `fix-${result.check_id}`,
        description:
          `Fix executor quote payload at ${requestUrl}. Ensure quote response is valid JSON and matches minimal sanity fields ` +
          `(from_chain:string, to_chain:string, amount_out:string), then re-verify. ` +
          `reason_code=${result.reason_code ?? "none"}. evidence_summary=${readEvidenceSummary(result)}`,
        requires_signature: false
      });
    }
  }

  return steps;
}

export function buildTxPlanFromCheckResults(
  options: RuntimeOptions,
  results: CheckResult[]
): TxPlan {
  const steps = buildActionStepsFromResults(results);
  return {
    generated_at: new Date().toISOString(),
    profile: options.profile,
    assumptions: [
      "Plan is generated from check failures only (no transaction execution).",
      "Mock-aware iteration: actionable mapping is currently implemented for CHK-007/008 and executor checks CHK-009/010/011/012.",
      "Preflight mode is read-only and does not sign or execute transactions."
    ],
    steps
  };
}

export function renderTxPlanMarkdown(plan: TxPlan): string {
  return [
    "# tx-plan",
    "",
    `- generated_at: ${plan.generated_at}`,
    `- profile: ${plan.profile}`,
    "",
    "## Assumptions",
    ...plan.assumptions.map((item) => `- ${item}`),
    "",
    "## Steps",
    ...(plan.steps.length === 0
      ? ["- No actions generated from current check failures."]
      : plan.steps.map(
          (step, idx) =>
            `${idx + 1}. [${step.id}] ${step.description} (requires_signature=${step.requires_signature})`
        ))
  ].join("\n");
}

export async function writeTxPlanArtifacts(
  outputDir: string,
  plan: TxPlan
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, "tx-plan.json");
  const markdownPath = join(outputDir, "tx-plan.md");
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderTxPlanMarkdown(plan)}\n`, "utf8");
  return { jsonPath, markdownPath };
}
