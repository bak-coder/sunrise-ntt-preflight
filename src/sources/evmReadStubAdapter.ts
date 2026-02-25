import { EvmReadAdapter } from "./contracts";

export class EvmReadStubAdapter implements EvmReadAdapter {
  async getPeerState(_input: { managerAddress: string; chainId: number }) {
    return {
      ok: false as const,
      reason_code: "NOT_IMPLEMENTED" as const,
      details:
        "TODO(iteration>2.1): wire real EVM read-only adapter for peer-registration checks."
    };
  }
}
