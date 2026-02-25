import { CheckDefinition } from "../types";

const SOLANA_PROGRAM_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export const nttIntentManagerProgramIdInvariantCheck: CheckDefinition = {
  id: "CHK-003-ntt-intent-manager-program-id-invariant",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const readResult = await context.adapters.configSource.readConfig(
      context.options.configPath
    );

    if (!readResult.ok) {
      return {
        status: "SKIPPED",
        reason_code: readResult.reason_code,
        details: `Domain check skipped because config source is unavailable: ${readResult.details}`,
        evidence: {
          summary: "Domain invariant cannot be evaluated without config intent source.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "ntt.json.manager.solanaProgramId must exist and be a base58-like Solana program id.",
            observed: {
              config_path: readResult.path
            },
            expected: {
              manager_path: "manager.solanaProgramId",
              format: "base58 string length 32..44"
            },
            retrieval_marker: readResult.retrieved_at,
            degradation: true
          }
        },
        degradation: true,
        source: "adapter/config-file"
      };
    }

    const parseResult = context.adapters.configSource.parseConfig(readResult.raw);
    if (!parseResult.ok) {
      return {
        status: "FAIL",
        reason_code: parseResult.reason_code,
        details: `Domain check cannot inspect config because JSON parse failed: ${parseResult.details}`,
        evidence: {
          summary: "Config is not parseable; domain invariant assertion failed.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "ntt.json.manager.solanaProgramId must exist and be a base58-like Solana program id.",
            observed: {
              config_path: readResult.path,
              raw_bytes: Buffer.byteLength(readResult.raw, "utf8")
            },
            expected: {
              manager_path: "manager.solanaProgramId",
              format: "base58 string length 32..44"
            },
            retrieval_marker: readResult.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const root = asObject(parseResult.parsed);
    const manager = root ? asObject(root.manager) : null;
    const solanaProgramId = manager?.solanaProgramId;
    const isValidProgramId =
      typeof solanaProgramId === "string" && SOLANA_PROGRAM_ID_PATTERN.test(solanaProgramId);

    if (!isValidProgramId) {
      return {
        status: "FAIL",
        reason_code: "NTT_MANAGER_PROGRAM_ID_INVALID",
        details:
          "Expected ntt.json.manager.solanaProgramId to be a base58 string with length 32..44.",
        evidence: {
          summary: "Domain invariant failed for manager.solanaProgramId.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "manager.solanaProgramId must be present to identify the NTT manager program on Solana.",
            observed: {
              config_path: readResult.path,
              manager_section_present: manager !== null,
              solana_program_id_type:
                solanaProgramId === null ? "null" : typeof solanaProgramId,
              solana_program_id_value:
                typeof solanaProgramId === "string" ? solanaProgramId : null
            },
            expected: {
              manager_path: "manager.solanaProgramId",
              format: "base58 string length 32..44"
            },
            retrieval_marker: readResult.retrieved_at,
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
      details: "Domain invariant passed: manager.solanaProgramId is present and valid.",
      evidence: {
        summary: "Config includes a valid manager.solanaProgramId intent field.",
        data: {
          source: readResult.source_kind,
          assertion_basis:
            "manager.solanaProgramId is required as a domain-level NTT intent anchor.",
          observed: {
            config_path: readResult.path,
            manager_section_present: true,
            solana_program_id: solanaProgramId
          },
          expected: {
            manager_path: "manager.solanaProgramId",
            format: "base58 string length 32..44"
          },
          retrieval_marker: readResult.retrieved_at,
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/config-file"
    };
  }
};
