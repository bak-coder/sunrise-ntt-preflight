import { CheckDefinition } from "../types";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function validatePeerValue(value: unknown): { ok: true } | { ok: false; reason: string } {
  if (typeof value !== "string") {
    return { ok: false, reason: "value must be a string" };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "value must be non-empty after trim" };
  }

  if (trimmed.startsWith("0x") && !EVM_ADDRESS_PATTERN.test(trimmed)) {
    return { ok: false, reason: "0x-prefixed value must match ^0x[a-fA-F0-9]{40}$" };
  }

  return { ok: true };
}

export const nttPeerMappingEntryValueShapeCheck: CheckDefinition = {
  id: "CHK-005-ntt-peer-mapping-entry-value-shape",
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
        details: `Peer mapping entry shape check skipped because config source is unavailable: ${readResult.details}`,
        evidence: {
          summary: "Cannot validate peer mapping entry values without readable config.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "Each top-level peers entry value must be string, non-empty, and 0x-prefixed values must be EVM-shaped.",
            observed: {
              config_path: readResult.path
            },
            expected: {
              section: "peers",
              value_rules: [
                "string",
                "non-empty after trim",
                "if startsWith(0x) -> ^0x[a-fA-F0-9]{40}$"
              ]
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
        details: `Peer mapping entry shape check failed because JSON parse failed: ${parseResult.details}`,
        evidence: {
          summary: "Config parse failed before peer entry shape validation.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "Each top-level peers entry value must be string, non-empty, and 0x-prefixed values must be EVM-shaped.",
            observed: {
              config_path: readResult.path,
              raw_bytes: Buffer.byteLength(readResult.raw, "utf8")
            },
            expected: {
              section: "peers",
              value_rules: [
                "string",
                "non-empty after trim",
                "if startsWith(0x) -> ^0x[a-fA-F0-9]{40}$"
              ]
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
    const hasPeersField = Boolean(root && "peers" in root);
    if (!hasPeersField) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_MISSING",
        details: "Expected top-level peers section to exist.",
        evidence: {
          summary: "peers section is missing.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "Top-level peers section is required for peer mapping entry validation.",
            observed: {
              config_path: readResult.path,
              peers_section_type: "missing"
            },
            expected: {
              section: "peers",
              shape: "object"
            },
            retrieval_marker: readResult.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const peers = asObject(root?.peers);
    if (!peers) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_SHAPE_INVALID",
        details: "Expected top-level peers section to be an object (non-array).",
        evidence: {
          summary: "peers section has invalid shape.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "Top-level peers section must be an object for entry validation.",
            observed: {
              config_path: readResult.path,
              peers_section_type: typeof root?.peers,
              peers_is_array: Array.isArray(root?.peers)
            },
            expected: {
              section: "peers",
              shape: "object"
            },
            retrieval_marker: readResult.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const entries = Object.entries(peers);
    if (entries.length === 0) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_EMPTY",
        details: "peers section exists but contains no entries.",
        evidence: {
          summary: "peers section is empty.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "At least one peers entry is required before entry shape validation.",
            observed: {
              config_path: readResult.path,
              peer_mapping_count: 0
            },
            expected: {
              section: "peers",
              min_entries: 1
            },
            retrieval_marker: readResult.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    for (const [peerKey, peerValue] of entries) {
      const result = validatePeerValue(peerValue);
      if (!result.ok) {
        return {
          status: "FAIL",
          reason_code: "NTT_PEER_MAPPING_ENTRY_VALUE_INVALID",
          details: `Invalid peers entry value at key '${peerKey}': ${result.reason}`,
          evidence: {
            summary: "Found invalid peer mapping entry value.",
            data: {
              source: readResult.source_kind,
              assertion_basis:
                "Each peers entry value must be string, non-empty, and EVM-shaped if 0x-prefixed.",
              observed: {
                config_path: readResult.path,
                first_invalid_key: peerKey,
                first_invalid_value:
                  typeof peerValue === "string" ? peerValue : String(peerValue),
                first_invalid_type: typeof peerValue,
                total_entries: entries.length
              },
              expected: {
                value_rules: [
                  "string",
                  "non-empty after trim",
                  "if startsWith(0x) -> ^0x[a-fA-F0-9]{40}$"
                ]
              },
              retrieval_marker: readResult.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "adapter/config-file"
        };
      }
    }

    return {
      status: "PASS",
      reason_code: null,
      details: "All peers entry values satisfy shape sanity invariant.",
      evidence: {
        summary: "Peer mapping entry values are shape-valid.",
        data: {
          source: readResult.source_kind,
          assertion_basis:
            "Each peers entry value must be string, non-empty, and EVM-shaped if 0x-prefixed.",
          observed: {
            config_path: readResult.path,
            peer_mapping_count: entries.length,
            peer_keys: entries.map(([peerKey]) => peerKey)
          },
          expected: {
            value_rules: [
              "string",
              "non-empty after trim",
              "if startsWith(0x) -> ^0x[a-fA-F0-9]{40}$"
            ]
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
