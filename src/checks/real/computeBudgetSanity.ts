import { CheckDefinition } from "../types";

const SOLANA_REDEEM_MIN_CU = 187_430;
const BUFFER_NUMERATOR = 12;
const BUFFER_DENOMINATOR = 10;
const BUFFER_MULTIPLIER = 1.2;
const REQUIRED_MINIMUM = Math.ceil((SOLANA_REDEEM_MIN_CU * BUFFER_NUMERATOR) / BUFFER_DENOMINATOR);

// Source note:
// docs/EXECUTOR_API.md documents static redeem baseline 187_430 CU and 120% safety buffer.
function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseGasLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

export const computeBudgetSanityCheck: CheckDefinition = {
  id: "CHK-013-compute-budget-sanity",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const configRead = await context.adapters.configSource.readConfig(context.options.configPath);
    if (!configRead.ok) {
      return {
        status: "SKIPPED",
        reason_code: configRead.reason_code,
        details: `Compute budget sanity skipped: ${configRead.details}`,
        evidence: {
          summary: "Config source unavailable for compute budget sanity check.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Compute budget sanity requires readable config intent source with gasLimit value.",
            observed: {
              config_path: configRead.path
            },
            expected: {
              config_readable: true
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/config-file"
      };
    }

    const configParse = context.adapters.configSource.parseConfig(configRead.raw);
    if (!configParse.ok) {
      return {
        status: "FAIL",
        reason_code: "CONFIG_PARSE_ERROR",
        details: `Compute budget sanity parse failed: ${configParse.details}`,
        evidence: {
          summary: "Config parse failed before compute budget sanity evaluation.",
          data: {
            source: configRead.source_kind,
            assertion_basis: "Compute budget sanity requires parseable config JSON.",
            observed: {
              config_path: configRead.path
            },
            expected: {
              parseable_json: true
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const root = asObject(configParse.parsed);
    const gasLimitRaw = root?.gasLimit;
    if (gasLimitRaw === undefined) {
      return {
        status: "SKIPPED",
        reason_code: "COMPUTE_BUDGET_GAS_LIMIT_MISSING",
        details: "Compute budget sanity skipped: required config field gasLimit is missing.",
        evidence: {
          summary: "gasLimit is missing; cannot statically assess compute budget threshold.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Static compute budget sanity requires configured gasLimit to compare against documented threshold.",
            observed: {
              config_path: configRead.path,
              has_gas_limit: false
            },
            expected: {
              has_gas_limit: true
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/config-file"
      };
    }

    const configuredGasLimit = parseGasLimit(gasLimitRaw);
    if (configuredGasLimit === null) {
      return {
        status: "SKIPPED",
        reason_code: "COMPUTE_BUDGET_GAS_LIMIT_UNPARSEABLE",
        details: "Compute budget sanity skipped: gasLimit is not an integer-like value.",
        evidence: {
          summary: "gasLimit value is present but not parseable as integer.",
          data: {
            source: configRead.source_kind,
            assertion_basis: "Static compute budget sanity compares integer gasLimit against static threshold.",
            observed: {
              config_path: configRead.path,
              gas_limit_type: typeof gasLimitRaw
            },
            expected: {
              gas_limit_type: "integer | numeric string"
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/config-file"
      };
    }

    const evidenceObserved = {
      configuredGasLimit,
      requiredMinimum: REQUIRED_MINIMUM,
      baseMinimum: SOLANA_REDEEM_MIN_CU,
      bufferMultiplier: BUFFER_MULTIPLIER,
      source: "NTT documented redeem CU (static)"
    };

    if (configuredGasLimit < REQUIRED_MINIMUM) {
      return {
        status: "FAIL",
        reason_code: "COMPUTE_BUDGET_BELOW_MINIMUM",
        details:
          `Configured gasLimit (${configuredGasLimit}) is below required minimum (${REQUIRED_MINIMUM}).`,
        evidence: {
          summary: "Configured gasLimit is below static safety threshold (documented minimum x 1.2).",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "configured gasLimit must satisfy requiredMinimum = ceil(baseMinimum * 1.2).",
            observed: evidenceObserved,
            expected: {
              minimum_condition: "configuredGasLimit >= requiredMinimum"
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    return {
      status: "PASS",
      reason_code: null,
      details:
        `Configured gasLimit (${configuredGasLimit}) satisfies required minimum (${REQUIRED_MINIMUM}).`,
      evidence: {
        summary: "Configured gasLimit satisfies static safety threshold.",
        data: {
          source: configRead.source_kind,
          assertion_basis:
            "configured gasLimit must satisfy requiredMinimum = ceil(baseMinimum * 1.2).",
          observed: evidenceObserved,
          expected: {
            minimum_condition: "configuredGasLimit >= requiredMinimum"
          },
          retrieval_marker: configRead.retrieved_at,
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/config-file"
    };
  }
};
