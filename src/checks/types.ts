import { AdapterRegistry } from "../sources/contracts";
import { CheckResult, RuntimeStatus, SeverityClass } from "../contracts/runtime";

export interface RuntimeOptions {
  profile: "ntt-generic" | "sunrise-executor";
  configPath: string;
  rpcUrl: string;
  rpcEvm?: string;
  executorUrl?: string;
  executorHealthPath?: string;
  executorCapabilitiesPath?: string;
  mockChain: boolean;
  mockChainPath: string;
  deep: boolean;
  outputDir: string;
  failOn: "blocking" | "all" | "none";
}

export interface CheckContext {
  options: RuntimeOptions;
  adapters: AdapterRegistry;
}

export interface RawCheckResult {
  status: RuntimeStatus;
  reason_code: string | null;
  details: string;
  evidence: CheckResult["evidence"];
  degradation: boolean;
  source: string;
}

export interface CheckDefinition {
  id: string;
  severity_class: SeverityClass;
  deterministic: boolean;
  run: (context: CheckContext) => Promise<RawCheckResult>;
}
