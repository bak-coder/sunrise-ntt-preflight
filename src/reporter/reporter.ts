import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { VerifyReport } from "../contracts/output";
import { CheckResult } from "../contracts/runtime";
import { RuntimeOptions } from "../checks/types";

function computeCiShouldFail(
  failOn: RuntimeOptions["failOn"],
  results: CheckResult[]
): boolean {
  if (failOn === "none") {
    return false;
  }

  if (failOn === "all") {
    return results.some((r) => r.status === "FAIL");
  }

  return results.some(
    (r) => r.status === "FAIL" && r.severity_class === "blocking"
  );
}

export function buildVerifyReport(
  options: RuntimeOptions,
  results: CheckResult[]
): VerifyReport {
  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    total: results.length,
    ci_should_fail: computeCiShouldFail(options.failOn, results)
  };

  return {
    generated_at: new Date().toISOString(),
    profile: options.profile,
    fail_on: options.failOn,
    summary,
    results
  };
}

export async function writeVerifyReport(
  outputDir: string,
  report: VerifyReport
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export function printVerifySummary(report: VerifyReport): void {
  const statusLine = report.summary.ci_should_fail ? "CI: FAIL" : "CI: PASS";
  console.log(
    `[verify] profile=${report.profile} pass=${report.summary.pass} fail=${report.summary.fail} skipped=${report.summary.skipped} total=${report.summary.total} ${statusLine}`
  );
}
