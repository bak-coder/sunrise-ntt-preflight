#!/usr/bin/env node
import { runCheckLifecycle } from "./checks/engine";
import { RuntimeOptions } from "./checks/types";
import {
  buildTxPlanFromCheckResults,
  buildTxPlanSkeleton,
  writeTxPlanArtifacts
} from "./plan/txPlan";
import { loadProfileChecks, ProfileName } from "./registry/profiles";
import { createAdapters } from "./sources/createAdapters";
import {
  buildVerifyReport,
  printVerifySummary,
  writeVerifyReport
} from "./reporter/reporter";

interface ParsedCli {
  command: "verify" | "plan";
  options: RuntimeOptions;
}

const profilesRequiringConfig = new Set<ProfileName>(["ntt-generic", "sunrise-executor"]);

function printUsage(): void {
  console.log("Usage:");
  console.log(
    "  ntt-preflight verify|plan --profile <ntt-generic|sunrise-executor> --rpc-url <url> [--config <path>] [--rpc-evm <url>] [--executor-url <url>] [--executor-health-path <path>] [--executor-capabilities-path <path>] [--executor-quote-path <path>] [--mock-chain [fixture]] [--deep] [--output <dir>] [--fail-on <blocking|all|none>]"
  );
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    return undefined;
  }
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parseMockChainOption(args: string[]): { enabled: boolean; path: string } {
  const idx = args.indexOf("--mock-chain");
  if (idx === -1) {
    return {
      enabled: false,
      path: "./fixtures/broken-state.json"
    };
  }

  const maybePath = args[idx + 1];
  if (maybePath && !maybePath.startsWith("--")) {
    return {
      enabled: true,
      path: maybePath
    };
  }

  return {
    enabled: true,
    path: "./fixtures/broken-state.json"
  };
}

function parseProfile(value: string | undefined): ProfileName {
  if (value === "ntt-generic" || value === "sunrise-executor") {
    return value;
  }
  throw new Error("Invalid --profile. Expected ntt-generic or sunrise-executor.");
}

function parseFailOn(value: string | undefined): RuntimeOptions["failOn"] {
  if (!value) {
    return "blocking";
  }
  if (value === "blocking" || value === "all" || value === "none") {
    return value;
  }
  throw new Error("Invalid --fail-on. Expected blocking, all, or none.");
}

function parseCli(argv: string[]): ParsedCli {
  const [, , commandRaw, ...rest] = argv;
  if (commandRaw !== "verify" && commandRaw !== "plan") {
    throw new Error("Command must be verify or plan.");
  }

  const profile = parseProfile(getFlagValue(rest, "--profile"));
  const rpcUrl = getFlagValue(rest, "--rpc-url");
  if (!rpcUrl) {
    throw new Error("--rpc-url is required.");
  }

  const mockChainOption = parseMockChainOption(rest);

  const options: RuntimeOptions = {
    profile,
    configPath: getFlagValue(rest, "--config") ?? "./ntt.json",
    rpcUrl,
    rpcEvm: getFlagValue(rest, "--rpc-evm"),
    executorUrl: getFlagValue(rest, "--executor-url"),
    executorHealthPath: getFlagValue(rest, "--executor-health-path") ?? "/",
    executorCapabilitiesPath: getFlagValue(rest, "--executor-capabilities-path") ?? "/v0/capabilities",
    executorQuotePath: getFlagValue(rest, "--executor-quote-path") ?? "/v0/quote",
    mockChain: mockChainOption.enabled,
    mockChainPath: mockChainOption.path,
    deep: hasFlag(rest, "--deep"),
    outputDir: getFlagValue(rest, "--output") ?? "./artifacts",
    failOn: parseFailOn(getFlagValue(rest, "--fail-on"))
  };

  return {
    command: commandRaw,
    options
  };
}

async function runVerify(options: RuntimeOptions): Promise<void> {
  const adapters = createAdapters({ rpcUrl: options.rpcUrl });
  if (profilesRequiringConfig.has(options.profile)) {
    const configRead = await adapters.configSource.readConfig(options.configPath);
    if (!configRead.ok) {
      throw new Error(
        `Required config precondition failed for profile ${options.profile}: ${configRead.reason_code} (${options.configPath}) - ${configRead.details}`
      );
    }
  }

  const checks = loadProfileChecks(options.profile);
  const results = await runCheckLifecycle({ options, adapters }, checks);
  const report = buildVerifyReport(options, results);
  const reportPath = await writeVerifyReport(options.outputDir, report);
  printVerifySummary(report);
  console.log(`[verify] report written to ${reportPath}`);
}

async function runPlan(options: RuntimeOptions): Promise<void> {
  const adapters = createAdapters({ rpcUrl: options.rpcUrl });
  const checks = loadProfileChecks(options.profile);
  const results = await runCheckLifecycle({ options, adapters }, checks);
  const plan = options.mockChain
    ? buildTxPlanFromCheckResults(options, results)
    : buildTxPlanSkeleton(options);
  const paths = await writeTxPlanArtifacts(options.outputDir, plan);
  console.log(`[plan] tx plan written to ${paths.markdownPath} and ${paths.jsonPath}`);
}

async function main(): Promise<void> {
  try {
    const parsed = parseCli(process.argv);
    if (parsed.command === "verify") {
      await runVerify(parsed.options);
      return;
    }
    await runPlan(parsed.options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] ${message}`);
    printUsage();
    process.exitCode = 1;
  }
}

void main();
