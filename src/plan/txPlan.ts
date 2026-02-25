import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TxPlan } from "../contracts/output";
import { RuntimeOptions } from "../checks/types";

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
    ...(plan.steps.length === 0 ? ["- No steps generated in scaffold baseline."] : [])
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
