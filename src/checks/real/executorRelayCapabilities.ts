import { CheckDefinition } from "../types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export const executorRelayCapabilitiesCheck: CheckDefinition = {
  id: "CHK-010-executor-relay-capabilities",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const capabilities = await context.adapters.executorHttp.getRelayCapabilities({
      endpoint: context.options.executorUrl,
      capabilities_path: context.options.executorCapabilitiesPath,
      mock_mode: context.options.mockChain
    });

    if (!capabilities.ok) {
      return {
        status: "SKIPPED",
        reason_code: capabilities.reason_code,
        details: `Executor capabilities check skipped: ${capabilities.details}`,
        evidence: {
          summary: "Capabilities endpoint could not be read due to configuration or transport degradation.",
          data: {
            source: "adapter/executor-http",
            assertion_basis:
              "Capabilities validation requires configured endpoint and transport-readable /v0/capabilities response.",
            observed: {
              mode: capabilities.mode,
              endpoint: capabilities.endpoint,
              request_url: capabilities.request_url
            },
            expected: {
              endpoint_configured: true,
              transport_reachable: true
            },
            retrieval_marker: {
              timestamp: capabilities.retrieved_at,
              request_id: capabilities.request_id
            },
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/executor-http"
      };
    }

    if (capabilities.http_status < 200 || capabilities.http_status > 299) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_CAPABILITIES_HTTP_NOT_OK",
        details: `Executor capabilities endpoint ${capabilities.request_url} returned HTTP ${capabilities.http_status} (expected 2xx).`,
        evidence: {
          summary: "Capabilities endpoint responded but HTTP status is outside minimal acceptable range.",
          data: {
            source: "adapter/executor-http",
            assertion_basis: "Capabilities endpoint must respond with HTTP 2xx.",
            observed: {
              mode: capabilities.mode,
              endpoint: capabilities.endpoint,
              request_url: capabilities.request_url,
              http_status: capabilities.http_status
            },
            expected: {
              status_range: "2xx"
            },
            retrieval_marker: {
              timestamp: capabilities.retrieved_at,
              request_id: capabilities.request_id
            },
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/executor-http"
      };
    }

    if (!capabilities.parseable_json) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_CAPABILITIES_PARSE_ERROR",
        details: `Executor capabilities endpoint ${capabilities.request_url} returned non-JSON payload.`,
        evidence: {
          summary: "Capabilities payload is not parseable JSON.",
          data: {
            source: "adapter/executor-http",
            assertion_basis: "Capabilities payload must be parseable JSON object.",
            observed: {
              mode: capabilities.mode,
              endpoint: capabilities.endpoint,
              request_url: capabilities.request_url,
              http_status: capabilities.http_status,
              parseable_json: capabilities.parseable_json
            },
            expected: {
              parseable_json: true
            },
            retrieval_marker: {
              timestamp: capabilities.retrieved_at,
              request_id: capabilities.request_id
            },
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/executor-http"
      };
    }

    const payload = asObject(capabilities.payload_json);
    const supportedChains = payload?.supported_chains;
    const supportedRelayTypes = payload?.supported_relay_types;
    const status = payload?.status;

    const shapeValid =
      Array.isArray(supportedChains) &&
      supportedChains.every((item) => typeof item === "string") &&
      Array.isArray(supportedRelayTypes) &&
      supportedRelayTypes.every((item) => typeof item === "string") &&
      typeof status === "string";

    if (!shapeValid) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_CAPABILITIES_SHAPE_INVALID",
        details:
          "Capabilities payload is missing required fields/types: supported_chains:string[], supported_relay_types:string[], status:string.",
        evidence: {
          summary: "Capabilities payload parsed but failed minimal shape validation.",
          data: {
            source: "adapter/executor-http",
            assertion_basis:
              "Minimal required fields: supported_chains:string[], supported_relay_types:string[], status:string.",
            observed: {
              mode: capabilities.mode,
              endpoint: capabilities.endpoint,
              request_url: capabilities.request_url,
              http_status: capabilities.http_status,
              has_supported_chains: Array.isArray(supportedChains),
              has_supported_relay_types: Array.isArray(supportedRelayTypes),
              has_status_string: typeof status === "string"
            },
            expected: {
              supported_chains: "string[]",
              supported_relay_types: "string[]",
              status: "string"
            },
            retrieval_marker: {
              timestamp: capabilities.retrieved_at,
              request_id: capabilities.request_id
            },
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/executor-http"
      };
    }

    return {
      status: "PASS",
      reason_code: null,
      details: `Executor capabilities payload at ${capabilities.request_url} satisfies minimal shape policy.`,
      evidence: {
        summary: "Capabilities payload is available and meets minimal field/type requirements.",
        data: {
          source: "adapter/executor-http",
          assertion_basis:
            "Minimal required fields: supported_chains:string[], supported_relay_types:string[], status:string.",
          observed: {
            mode: capabilities.mode,
            endpoint: capabilities.endpoint,
            request_url: capabilities.request_url,
            http_status: capabilities.http_status,
            supported_chains_count: (supportedChains as string[]).length,
            supported_relay_types_count: (supportedRelayTypes as string[]).length,
            status
          },
          expected: {
            supported_chains_min_count: 0,
            supported_relay_types_min_count: 0,
            status_type: "string"
          },
          retrieval_marker: {
            timestamp: capabilities.retrieved_at,
            request_id: capabilities.request_id
          },
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/executor-http"
    };
  }
};
