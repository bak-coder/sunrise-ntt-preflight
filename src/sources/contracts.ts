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

export type SolanaRpcReadFailureReasonCode =
  | "RPC_UNAVAILABLE"
  | "RPC_TIMEOUT"
  | "RPC_READ_ERROR"
  | "RPC_RESPONSE_INVALID";

export interface SolanaHealthSuccess {
  ok: true;
  endpoint: string;
  retrieved_at: string;
  request_id: string;
  response_kind: "result" | "error";
  health_result?: string;
  rpc_error?: {
    code: number;
    message: string;
  };
}

export interface SolanaHealthFailure {
  ok: false;
  endpoint: string;
  retrieved_at: string;
  request_id: string;
  reason_code: SolanaRpcReadFailureReasonCode;
  details: string;
  degradation: true;
}

export type SolanaHealthReadResult = SolanaHealthSuccess | SolanaHealthFailure;

export interface SolanaReadAdapter {
  getHealth(): Promise<SolanaHealthReadResult>;
}

export interface AdapterRegistry {
  configSource: ConfigSourceAdapter;
  evmRead: EvmReadAdapter;
  solanaRead: SolanaReadAdapter;
}
