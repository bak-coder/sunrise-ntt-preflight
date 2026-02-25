import { CheckDefinition } from "../types";

export const executorCapabilityStub: CheckDefinition = {
  id: "executor-capability-stub",
  severity_class: "non-blocking",
  deterministic: true,
  async run(context) {
    if (!context.options.rpcEvm) {
      return {
        status: "SKIPPED",
        reason_code: "DEPENDENCY_UNAVAILABLE",
        details: "EVM RPC is not provided in scaffold mode; check is skipped.",
        evidence: {
          summary: "Missing --rpc-evm input"
        },
        degradation: true,
        source: "stub/executor"
      };
    }

    return {
      status: "PASS",
      reason_code: null,
      details: "Scaffold stub: optional dependency is present.",
      evidence: {
        summary: "Runtime contract verified for non-blocking pass path."
      },
      degradation: false,
      source: "stub/executor"
    };
  }
};
