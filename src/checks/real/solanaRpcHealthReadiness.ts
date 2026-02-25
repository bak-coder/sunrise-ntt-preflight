import { CheckDefinition } from "../types";

export const solanaRpcHealthReadinessCheck: CheckDefinition = {
  id: "CHK-002-solana-rpc-health-readiness",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const health = await context.adapters.solanaRead.getHealth();

    if (!health.ok) {
      return {
        status: "SKIPPED",
        reason_code: health.reason_code,
        details: `Solana RPC unavailable: ${health.details}`,
        evidence: {
          summary: "Unable to retrieve Solana RPC health response.",
          data: {
            source: "adapter/solana-json-rpc",
            observed: {
              endpoint: health.endpoint
            },
            assertion_basis: "Solana RPC must be reachable to run deterministic on-chain checks.",
            retrieval_marker: {
              timestamp: health.retrieved_at,
              request_id: health.request_id
            },
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/solana-json-rpc"
      };
    }

    if (health.response_kind === "result" && health.health_result === "ok") {
      return {
        status: "PASS",
        reason_code: null,
        details: "Solana RPC health returned ok.",
        evidence: {
          summary: "Solana RPC endpoint is healthy for read-only operations.",
          data: {
            source: "adapter/solana-json-rpc",
            observed: {
              endpoint: health.endpoint,
              health_result: health.health_result
            },
            assertion_basis: "RPC getHealth result must equal 'ok'.",
            retrieval_marker: {
              timestamp: health.retrieved_at,
              request_id: health.request_id
            },
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/solana-json-rpc"
      };
    }

    return {
      status: "FAIL",
      reason_code: "RPC_HEALTH_NOT_OK",
      details:
        health.response_kind === "error"
          ? `Solana RPC reported error ${health.rpc_error?.code}: ${health.rpc_error?.message}`
          : `Unexpected health result: ${health.health_result ?? "unknown"}`,
      evidence: {
        summary: "Solana RPC endpoint responded but health assertion failed.",
        data: {
          source: "adapter/solana-json-rpc",
          observed: {
            endpoint: health.endpoint,
            response_kind: health.response_kind,
            health_result: health.health_result ?? null,
            rpc_error: health.rpc_error ?? null
          },
          assertion_basis: "RPC getHealth result must equal 'ok'.",
          retrieval_marker: {
            timestamp: health.retrieved_at,
            request_id: health.request_id
          },
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/solana-json-rpc"
    };
  }
};
