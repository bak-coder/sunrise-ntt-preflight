import { CheckDefinition } from "../types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export const nttPeerChainMappingPresenceCheck: CheckDefinition = {
  id: "CHK-004-ntt-peer-chain-mapping-presence",
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
        details: `Peer/chain mapping check skipped because config source is unavailable: ${readResult.details}`,
        evidence: {
          summary: "Domain peer mapping invariant cannot run without config source.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "ntt.json must contain a non-empty peers mapping.",
            observed: {
              config_path: readResult.path
            },
            expected: {
              section: "peers",
              min_entries: 1
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
        details: `Peer/chain mapping check failed because JSON parse failed: ${parseResult.details}`,
        evidence: {
          summary: "Config parse failed before peer mapping invariant evaluation.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "ntt.json must contain a non-empty peers mapping.",
            observed: {
              config_path: readResult.path,
              raw_bytes: Buffer.byteLength(readResult.raw, "utf8")
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

    const root = asObject(parseResult.parsed);
    const peers = root ? asObject(root.peers) : null;
    const peerKeys = peers ? Object.keys(peers) : [];

    if (!peers) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_MISSING",
        details: "Expected ntt.json to include a peers section with at least one entry.",
        evidence: {
          summary: "Peer/chain mapping section is missing.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "At least one peer/chain mapping must be declared in intent.",
            observed: {
              config_path: readResult.path,
              peers_section_present: false
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

    if (peerKeys.length === 0) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_EMPTY",
        details: "peers section exists but contains no entries.",
        evidence: {
          summary: "Peer/chain mapping section is empty.",
          data: {
            source: readResult.source_kind,
            assertion_basis: "At least one peer/chain mapping must be declared in intent.",
            observed: {
              config_path: readResult.path,
              peers_section_present: true,
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

    return {
      status: "PASS",
      reason_code: null,
      details: "Peer/chain mapping invariant passed: peers section contains entries.",
      evidence: {
        summary: "Intent includes non-empty peer/chain mapping.",
        data: {
          source: readResult.source_kind,
          assertion_basis: "At least one peer/chain mapping must be declared in intent.",
          observed: {
            config_path: readResult.path,
            peers_section_present: true,
            peer_mapping_count: peerKeys.length,
            peer_mapping_keys: peerKeys
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
};
