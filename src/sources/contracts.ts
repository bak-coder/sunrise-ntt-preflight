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
  | "RPC_RESPONSE_INVALID"
  | "PEER_PDA_DERIVATION_FAILED"
  | "PEER_ACCOUNT_DECIMALS_UNPARSEABLE";

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

export interface SolanaPeerAccountExistenceInput {
  manager_program_id: string;
  chain_id: number;
}

export interface SolanaPeerAccountExistenceSuccess {
  ok: true;
  endpoint: string;
  retrieved_at: string;
  request_id: string;
  manager_program_id: string;
  chain_id: number;
  pda: string;
  exists: boolean;
  decimals: number | null;
  decimals_source:
    | "peer-account-token-decimals-offset-40"
    | "not-applicable-account-missing";
}

export interface SolanaPeerAccountExistenceFailure {
  ok: false;
  endpoint: string;
  retrieved_at: string;
  request_id: string;
  manager_program_id: string;
  chain_id: number;
  reason_code: SolanaRpcReadFailureReasonCode;
  details: string;
  degradation: true;
}

export type SolanaPeerAccountExistenceResult =
  | SolanaPeerAccountExistenceSuccess
  | SolanaPeerAccountExistenceFailure;

export interface SolanaReadAdapter {
  getHealth(): Promise<SolanaHealthReadResult>;
  getPeerAccountExistence(
    input: SolanaPeerAccountExistenceInput
  ): Promise<SolanaPeerAccountExistenceResult>;
}

export type ExecutorHttpReadFailureReasonCode =
  | "EXECUTOR_ENDPOINT_NOT_CONFIGURED"
  | "EXECUTOR_ENDPOINT_INVALID"
  | "EXECUTOR_HTTP_UNAVAILABLE"
  | "EXECUTOR_HTTP_TIMEOUT"
  | "EXECUTOR_HTTP_READ_ERROR"
  | "EXECUTOR_MOCK_RESPONSE_INVALID"
  | "EXECUTOR_CAPABILITIES_RESPONSE_INVALID";

export interface ExecutorEndpointReachabilityInput {
  endpoint?: string;
  health_path?: string;
  mock_mode: boolean;
}

export interface ExecutorEndpointReachabilitySuccess {
  ok: true;
  mode: "mock" | "real";
  endpoint: string;
  request_url: string;
  retrieved_at: string;
  request_id: string;
  http_status: number;
  reachable: boolean;
}

export interface ExecutorEndpointReachabilityFailure {
  ok: false;
  mode: "mock" | "real";
  endpoint: string | null;
  request_url: string | null;
  retrieved_at: string;
  request_id: string;
  reason_code: ExecutorHttpReadFailureReasonCode;
  details: string;
  degradation: true;
}

export type ExecutorEndpointReachabilityResult =
  | ExecutorEndpointReachabilitySuccess
  | ExecutorEndpointReachabilityFailure;

export interface ExecutorCapabilitiesReadInput {
  endpoint?: string;
  capabilities_path?: string;
  mock_mode: boolean;
}

export interface ExecutorCapabilitiesReadSuccess {
  ok: true;
  mode: "mock" | "real";
  endpoint: string;
  request_url: string;
  retrieved_at: string;
  request_id: string;
  http_status: number;
  payload_raw: string;
  payload_json: unknown | null;
  parseable_json: boolean;
}

export interface ExecutorCapabilitiesReadFailure {
  ok: false;
  mode: "mock" | "real";
  endpoint: string | null;
  request_url: string | null;
  retrieved_at: string;
  request_id: string;
  reason_code: ExecutorHttpReadFailureReasonCode;
  details: string;
  degradation: true;
}

export type ExecutorCapabilitiesReadResult =
  | ExecutorCapabilitiesReadSuccess
  | ExecutorCapabilitiesReadFailure;

export interface ExecutorHttpAdapter {
  getEndpointReachability(
    input: ExecutorEndpointReachabilityInput
  ): Promise<ExecutorEndpointReachabilityResult>;
  getRelayCapabilities(
    input: ExecutorCapabilitiesReadInput
  ): Promise<ExecutorCapabilitiesReadResult>;
}

export interface AdapterRegistry {
  configSource: ConfigSourceAdapter;
  evmRead: EvmReadAdapter;
  solanaRead: SolanaReadAdapter;
  executorHttp: ExecutorHttpAdapter;
}
