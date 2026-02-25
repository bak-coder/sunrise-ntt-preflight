import { CheckDefinition } from "../types";

const PEER_KEY_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function validatePeerKey(key: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = key.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "key must be non-empty after trim" };
  }

  if (trimmed !== key) {
    return { ok: false, reason: "key must not have leading or trailing spaces" };
  }

  if (!PEER_KEY_PATTERN.test(key)) {
    return { ok: false, reason: "key must match ^[a-z0-9][a-z0-9-_]*$" };
  }

  return { ok: true };
}

export const nttPeerMappingKeyShapeCheck: CheckDefinition = {
  id: "CHK-006-ntt-peer-mapping-key-shape",
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
        details: `Peer mapping key shape check skipped because config source is unavailable: ${readResult.details}`,
        evidence: {
          summary: "Cannot validate peer mapping keys without readable config.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "Each top-level peers key must be trimmed, non-empty, and slug-like lowercase.",
            observed: {
              config_path: readResult.path
            },
            expected: {
              section: "peers",
              key_rules: [
                "string",
                "non-empty after trim",
                "equals key.trim()",
                "matches ^[a-z0-9][a-z0-9-_]*$"
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
        details: `Peer mapping key shape check failed because JSON parse failed: ${parseResult.details}`,
        evidence: {
          summary: "Config parse failed before peer key shape validation.",
          data: {
            source: readResult.source_kind,
            assertion_basis:
              "Each top-level peers key must be trimmed, non-empty, and slug-like lowercase.",
            observed: {
              config_path: readResult.path,
              raw_bytes: Buffer.byteLength(readResult.raw, "utf8")
            },
            expected: {
              section: "peers",
              key_rules: [
                "string",
                "non-empty after trim",
                "equals key.trim()",
                "matches ^[a-z0-9][a-z0-9-_]*$"
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
            assertion_basis: "Top-level peers section is required for peer key validation.",
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
            assertion_basis: "Top-level peers section must be object for key validation.",
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
            assertion_basis: "At least one peers entry is required before key shape validation.",
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

    for (const [peerKey] of entries) {
      const keyValidation = validatePeerKey(peerKey);
      if (!keyValidation.ok) {
        return {
          status: "FAIL",
          reason_code: "NTT_PEER_MAPPING_KEY_INVALID",
          details: `Invalid peers key '${peerKey}': ${keyValidation.reason}`,
          evidence: {
            summary: "Found invalid peer mapping key.",
            data: {
              source: readResult.source_kind,
              assertion_basis:
                "Each peers key must be trimmed, non-empty, and match ^[a-z0-9][a-z0-9-_]*$",
              observed: {
                config_path: readResult.path,
                first_invalid_key: peerKey,
                first_invalid_key_trimmed: peerKey.trim(),
                total_entries: entries.length
              },
              expected: {
                key_rules: [
                  "string",
                  "non-empty after trim",
                  "equals key.trim()",
                  "matches ^[a-z0-9][a-z0-9-_]*$"
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
      details: "All peers keys satisfy key shape sanity invariant.",
      evidence: {
        summary: "Peer mapping keys are shape-valid.",
        data: {
          source: readResult.source_kind,
          assertion_basis:
            "Each peers key must be trimmed, non-empty, and match ^[a-z0-9][a-z0-9-_]*$",
          observed: {
            config_path: readResult.path,
            peer_mapping_count: entries.length,
            peer_keys: entries.map(([key]) => key)
          },
          expected: {
            key_rules: [
              "string",
              "non-empty after trim",
              "equals key.trim()",
              "matches ^[a-z0-9][a-z0-9-_]*$"
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
