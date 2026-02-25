import { AdapterRegistry } from "./contracts";
import { ConfigFileAdapter } from "./configFileAdapter";
import { EvmReadStubAdapter } from "./evmReadStubAdapter";
import { SolanaRpcAdapter } from "./solanaRpcAdapter";

interface CreateAdaptersInput {
  rpcUrl: string;
}

export function createAdapters(input: CreateAdaptersInput): AdapterRegistry {
  return {
    configSource: new ConfigFileAdapter(),
    evmRead: new EvmReadStubAdapter(),
    solanaRead: new SolanaRpcAdapter({
      endpoint: input.rpcUrl
    })
  };
}
