import { CheckDefinition } from "../types";

export const genericIntentVsActualStub: CheckDefinition = {
  id: "generic-intent-vs-actual-stub",
  severity_class: "blocking",
  deterministic: true,
  async run() {
    return {
      status: "PASS",
      reason_code: null,
      details: "Scaffold stub: deterministic contract path is wired.",
      evidence: {
        summary: "No on-chain RPC call in scaffold baseline."
      },
      degradation: false,
      source: "stub/generic"
    };
  }
};
