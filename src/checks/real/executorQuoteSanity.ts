import { CheckDefinition } from "../types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export const executorQuoteSanityCheck: CheckDefinition = {
  id: "CHK-012-executor-quote-sanity",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const quotePayload = await context.adapters.executorHttp.getQuotePayload({
      endpoint: context.options.executorUrl,
      quote_path: context.options.executorQuotePath,
      mock_mode: context.options.mockChain
    });

    if (!quotePayload.ok) {
      return {
        status: "SKIPPED",
        reason_code: quotePayload.reason_code,
        details: `Executor quote sanity check skipped: ${quotePayload.details}`,
        evidence: {
          summary: "Quote payload source could not be retrieved due to mock source degradation.",
          data: {
            source: "adapter/executor-http",
            assertion_basis:
              "Quote sanity validation requires retrievable quote payload source in mock-first mode.",
            observed: {
              mode: quotePayload.mode,
              endpoint: quotePayload.endpoint,
              request_url: quotePayload.request_url
            },
            expected: {
              payload_retrievable: true
            },
            retrieval_marker: {
              timestamp: quotePayload.retrieved_at,
              request_id: quotePayload.request_id
            },
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/executor-http"
      };
    }

    if (!quotePayload.parseable_json) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_QUOTE_PARSE_ERROR",
        details: `Executor quote payload at ${quotePayload.request_url} is not parseable JSON.`,
        evidence: {
          summary: "Quote payload retrieval succeeded but payload is not valid JSON.",
          data: {
            source: "adapter/executor-http",
            assertion_basis: "Quote payload must be parseable JSON object.",
            observed: {
              mode: quotePayload.mode,
              endpoint: quotePayload.endpoint,
              request_url: quotePayload.request_url,
              parseable_json: quotePayload.parseable_json
            },
            expected: {
              parseable_json: true
            },
            retrieval_marker: {
              timestamp: quotePayload.retrieved_at,
              request_id: quotePayload.request_id
            },
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/executor-http"
      };
    }

    const payload = asObject(quotePayload.payload_json);
    const fromChain = payload?.from_chain;
    const toChain = payload?.to_chain;
    const amountOut = payload?.amount_out;
    const shapeValid =
      typeof fromChain === "string" &&
      fromChain.trim().length > 0 &&
      typeof toChain === "string" &&
      toChain.trim().length > 0 &&
      typeof amountOut === "string" &&
      amountOut.trim().length > 0;

    if (!shapeValid) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_QUOTE_SHAPE_INVALID",
        details:
          "Quote payload parsed but failed minimal shape policy: from_chain:string, to_chain:string, amount_out:string (non-empty).",
        evidence: {
          summary: "Quote payload is parseable but missing required top-level fields/types.",
          data: {
            source: "adapter/executor-http",
            assertion_basis:
              "Mock-first minimal quote sanity policy assumes top-level fields from_chain/to_chain/amount_out as non-empty strings.",
            observed: {
              mode: quotePayload.mode,
              endpoint: quotePayload.endpoint,
              request_url: quotePayload.request_url,
              has_from_chain_string: typeof fromChain === "string" && fromChain.trim().length > 0,
              has_to_chain_string: typeof toChain === "string" && toChain.trim().length > 0,
              has_amount_out_string: typeof amountOut === "string" && amountOut.trim().length > 0
            },
            expected: {
              from_chain: "string(non-empty)",
              to_chain: "string(non-empty)",
              amount_out: "string(non-empty)"
            },
            retrieval_marker: {
              timestamp: quotePayload.retrieved_at,
              request_id: quotePayload.request_id
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
      details: `Executor quote payload at ${quotePayload.request_url} satisfies minimal sanity shape policy.`,
      evidence: {
        summary: "Quote payload is parseable and satisfies minimal top-level shape policy.",
        data: {
          source: "adapter/executor-http",
          assertion_basis:
            "Mock-first minimal quote sanity policy assumes top-level fields from_chain/to_chain/amount_out as non-empty strings.",
          observed: {
            mode: quotePayload.mode,
            endpoint: quotePayload.endpoint,
            request_url: quotePayload.request_url,
            from_chain: fromChain,
            to_chain: toChain,
            amount_out: amountOut
          },
          expected: {
            from_chain: "string(non-empty)",
            to_chain: "string(non-empty)",
            amount_out: "string(non-empty)"
          },
          retrieval_marker: {
            timestamp: quotePayload.retrieved_at,
            request_id: quotePayload.request_id
          },
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/executor-http"
    };
  }
};
