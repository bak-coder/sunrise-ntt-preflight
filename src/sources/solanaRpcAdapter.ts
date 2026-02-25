import { SolanaHealthReadResult, SolanaReadAdapter } from "./contracts";

interface SolanaRpcAdapterOptions {
  endpoint: string;
  timeoutMs?: number;
}

function buildRequestId(): string {
  return `solana-health-${Date.now()}`;
}

export class SolanaRpcAdapter implements SolanaReadAdapter {
  private endpoint: string;
  private timeoutMs: number;

  constructor(options: SolanaRpcAdapterOptions) {
    this.endpoint = options.endpoint;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async getHealth(): Promise<SolanaHealthReadResult> {
    const retrieved_at = new Date().toISOString();
    const request_id = buildRequestId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request_id,
          method: "getHealth",
          params: []
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false,
          endpoint: this.endpoint,
          retrieved_at,
          request_id,
          reason_code: "RPC_READ_ERROR",
          details: `HTTP ${response.status} ${response.statusText}`,
          degradation: true
        };
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const rpcResult = payload.result;
      const rpcError = payload.error;

      if (typeof rpcResult === "string") {
        return {
          ok: true,
          endpoint: this.endpoint,
          retrieved_at,
          request_id,
          response_kind: "result",
          health_result: rpcResult
        };
      }

      if (
        typeof rpcError === "object" &&
        rpcError !== null &&
        typeof (rpcError as { code?: unknown }).code === "number" &&
        typeof (rpcError as { message?: unknown }).message === "string"
      ) {
        return {
          ok: true,
          endpoint: this.endpoint,
          retrieved_at,
          request_id,
          response_kind: "error",
          rpc_error: {
            code: (rpcError as { code: number }).code,
            message: (rpcError as { message: string }).message
          }
        };
      }

      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        reason_code: "RPC_RESPONSE_INVALID",
        details: "RPC response is not parseable as getHealth result or error.",
        degradation: true
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          endpoint: this.endpoint,
          retrieved_at,
          request_id,
          reason_code: "RPC_TIMEOUT",
          details: `RPC timeout after ${this.timeoutMs}ms.`,
          degradation: true
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        reason_code: "RPC_UNAVAILABLE",
        details: message,
        degradation: true
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
