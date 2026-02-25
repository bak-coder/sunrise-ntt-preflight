import { PublicKey } from "@solana/web3.js";
import {
  SolanaHealthReadResult,
  SolanaPeerAccountExistenceInput,
  SolanaPeerAccountExistenceResult,
  SolanaReadAdapter
} from "./contracts";

interface SolanaRpcAdapterOptions {
  endpoint: string;
  timeoutMs?: number;
}

function buildRequestId(): string {
  return `solana-health-${Date.now()}`;
}

function buildPeerRequestId(): string {
  return `solana-peer-exists-${Date.now()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export class SolanaRpcAdapter implements SolanaReadAdapter {
  private endpoint: string;
  private timeoutMs: number;

  constructor(options: SolanaRpcAdapterOptions) {
    this.endpoint = options.endpoint;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async rpcCall(
    method: string,
    request_id: string,
    params: unknown[]
  ): Promise<
    | {
        ok: true;
        payload: Record<string, unknown>;
      }
    | {
        ok: false;
        reason_code: "RPC_TIMEOUT" | "RPC_UNAVAILABLE" | "RPC_READ_ERROR";
        details: string;
      }
  > {
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
          method,
          params
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false,
          reason_code: "RPC_READ_ERROR",
          details: `HTTP ${response.status} ${response.statusText}`
        };
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return { ok: true, payload };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          reason_code: "RPC_TIMEOUT",
          details: `RPC timeout after ${this.timeoutMs}ms.`
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason_code: "RPC_UNAVAILABLE",
        details: message
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getHealth(): Promise<SolanaHealthReadResult> {
    const retrieved_at = new Date().toISOString();
    const request_id = buildRequestId();
    const rpcRead = await this.rpcCall("getHealth", request_id, []);
    if (!rpcRead.ok) {
      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        reason_code: rpcRead.reason_code,
        details: rpcRead.details,
        degradation: true
      };
    }

    try {
      const payload = rpcRead.payload;
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
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        reason_code: "RPC_RESPONSE_INVALID",
        details: message,
        degradation: true
      };
    }
  }

  async getPeerAccountExistence(
    input: SolanaPeerAccountExistenceInput
  ): Promise<SolanaPeerAccountExistenceResult> {
    const retrieved_at = new Date().toISOString();
    const request_id = buildPeerRequestId();
    const chain_id = input.chain_id;
    const manager_program_id = input.manager_program_id;

    let pda: string;
    try {
      // NTT peer PDA convention used in project docs:
      // seeds = ["peer", uint16_le(chain_id)] under manager program id.
      const chainSeed = Buffer.alloc(2);
      chainSeed.writeUInt16LE(chain_id);
      const [peerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("peer"), chainSeed],
        new PublicKey(manager_program_id)
      );
      pda = peerPda.toBase58();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        manager_program_id,
        chain_id,
        reason_code: "PEER_PDA_DERIVATION_FAILED",
        details: `Failed to derive peer PDA: ${message}`,
        degradation: true
      };
    }

    const rpcRead = await this.rpcCall("getAccountInfo", request_id, [
      pda,
      {
        encoding: "base64"
      }
    ]);
    if (!rpcRead.ok) {
      return {
        ok: false,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        manager_program_id,
        chain_id,
        reason_code: rpcRead.reason_code,
        details: rpcRead.details,
        degradation: true
      };
    }

    const value = (rpcRead.payload.result as { value?: unknown } | undefined)?.value;
    if (value === null) {
      return {
        ok: true,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        manager_program_id,
        chain_id,
        pda,
        exists: false
      };
    }

    if (typeof value === "object" && value !== null) {
      return {
        ok: true,
        endpoint: this.endpoint,
        retrieved_at,
        request_id,
        manager_program_id,
        chain_id,
        pda,
        exists: true
      };
    }

    return {
      ok: false,
      endpoint: this.endpoint,
      retrieved_at,
      request_id,
      manager_program_id,
      chain_id,
      reason_code: "RPC_RESPONSE_INVALID",
      details: "RPC response is not parseable as getAccountInfo result.",
      degradation: true
    };
  }
}
