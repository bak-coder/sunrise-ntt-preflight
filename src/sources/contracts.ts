export type ConfigReadFailureReasonCode = "CONFIG_NOT_FOUND" | "CONFIG_UNREADABLE";

export interface ConfigReadSuccess {
  ok: true;
  source_kind: "config-file";
  path: string;
  retrieved_at: string;
  raw: string;
}

export interface ConfigReadFailure {
  ok: false;
  source_kind: "config-file";
  path: string;
  retrieved_at: string;
  reason_code: ConfigReadFailureReasonCode;
  details: string;
  degradation: true;
}

export type ConfigReadResult = ConfigReadSuccess | ConfigReadFailure;

export type ConfigParseResult =
  | {
      ok: true;
      parsed: unknown;
    }
  | {
      ok: false;
      reason_code: "CONFIG_PARSE_ERROR";
      details: string;
    };

export interface ConfigSourceAdapter {
  readConfig(path: string): Promise<ConfigReadResult>;
  parseConfig(raw: string): ConfigParseResult;
}

export interface EvmReadAdapter {
  getPeerState(_input: { managerAddress: string; chainId: number }): Promise<{
    ok: false;
    reason_code: "NOT_IMPLEMENTED";
    details: string;
  }>;
}

export interface AdapterRegistry {
  configSource: ConfigSourceAdapter;
  evmRead: EvmReadAdapter;
}
