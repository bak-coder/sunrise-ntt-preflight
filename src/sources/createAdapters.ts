import { AdapterRegistry } from "./contracts";
import { ConfigFileAdapter } from "./configFileAdapter";
import { EvmReadStubAdapter } from "./evmReadStubAdapter";

export function createAdapters(): AdapterRegistry {
  return {
    configSource: new ConfigFileAdapter(),
    evmRead: new EvmReadStubAdapter()
  };
}
