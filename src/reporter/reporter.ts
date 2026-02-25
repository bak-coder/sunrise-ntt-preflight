import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { VerifyReport, VerifyReportCheck, VerifyReportLegacy } from "../contracts/output";
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
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;
  const ciShouldFail = computeCiShouldFail(options.failOn, results);
  const checks: VerifyReportCheck[] = results.map((result) => {
    const observed = (result.evidence.data?.observed as Record<string, unknown> | undefined) ?? {};
    return {
      id: result.check_id,
      name: result.check_id.replace(/^CHK-\d{3}-/, ""),
      status: result.status,
      reason_code: result.reason_code,
      evidence: {
        ...observed,
        summary: result.evidence.summary
      }
    };
  });

  return {
    meta: {
      profile: options.profile,
      timestamp: new Date().toISOString(),
      config_path: options.configPath
    },
    checks,
    summary: {
      pass,
      fail,
      skipped,
      ready: !ciShouldFail
    }
  };
}

function buildLegacyVerifyReport(
  options: RuntimeOptions,
  results: CheckResult[]
): VerifyReportLegacy {
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
  report: VerifyReport,
  legacyReport: VerifyReportLegacy
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const reportPath = join(outputDir, "report.json");
  const legacyReportPath = join(outputDir, "report.legacy.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(legacyReportPath, `${JSON.stringify(legacyReport, null, 2)}\n`, "utf8");
  return reportPath;
}

export function printVerifySummary(report: VerifyReport): void {
  const statusLine = report.summary.ready ? "CI: PASS" : "CI: FAIL";
  console.log(
    `[verify] profile=${report.meta.profile} pass=${report.summary.pass} fail=${report.summary.fail} skipped=${report.summary.skipped} total=${report.checks.length} ${statusLine}`
  );
}

export { buildLegacyVerifyReport };
