import { CheckDefinition } from "../types";

export const executorEndpointReachabilityCheck: CheckDefinition = {
  id: "CHK-009-executor-endpoint-reachability",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const reachability = await context.adapters.executorHttp.getEndpointReachability({
      endpoint: context.options.executorUrl,
      health_path: context.options.executorHealthPath,
      mock_mode: context.options.mockChain
    });

    if (!reachability.ok) {
      return {
        status: "SKIPPED",
        reason_code: reachability.reason_code,
        details: `Executor endpoint reachability check skipped: ${reachability.details}`,
        evidence: {
          summary: "Executor endpoint could not be reached due to configuration or transport degradation.",
          data: {
            source: "adapter/executor-http",
            assertion_basis:
              "Executor endpoint must be configured and transport-reachable for reachability verification.",
            observed: {
              mode: reachability.mode,
              endpoint: reachability.endpoint,
              request_url: reachability.request_url
            },
            expected: {
              endpoint_configured: true,
              transport_reachable: true
            },
            retrieval_marker: {
              timestamp: reachability.retrieved_at,
              request_id: reachability.request_id
            },
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/executor-http"
      };
    }

    if (!reachability.reachable) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_ENDPOINT_UNREACHABLE",
        details: `Executor endpoint ${reachability.request_url} responded with HTTP ${reachability.http_status} (expected 2xx).`,
        evidence: {
          summary: "Executor endpoint responded but failed minimal reachability policy.",
          data: {
            source: "adapter/executor-http",
            assertion_basis: "Minimal reachability policy: HTTP GET must return status in 2xx range.",
            observed: {
              mode: reachability.mode,
              endpoint: reachability.endpoint,
              request_url: reachability.request_url,
              http_status: reachability.http_status
            },
            expected: {
              status_range: "2xx"
            },
            retrieval_marker: {
              timestamp: reachability.retrieved_at,
              request_id: reachability.request_id
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
      details: `Executor endpoint ${reachability.request_url} is reachable (HTTP ${reachability.http_status}).`,
      evidence: {
        summary: "Executor endpoint satisfied minimal HTTP reachability policy.",
        data: {
          source: "adapter/executor-http",
          assertion_basis: "Minimal reachability policy: HTTP GET returns 2xx response.",
          observed: {
            mode: reachability.mode,
            endpoint: reachability.endpoint,
            request_url: reachability.request_url,
            http_status: reachability.http_status
          },
          expected: {
            status_range: "2xx"
          },
          retrieval_marker: {
            timestamp: reachability.retrieved_at,
            request_id: reachability.request_id
          },
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/executor-http"
    };
  }
};
