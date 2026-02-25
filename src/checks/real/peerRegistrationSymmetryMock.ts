import { CheckDefinition } from "../types";

interface MockDirectionalRegistration {
  from: string;
  to: string;
  registered: boolean;
  peerAddress?: string;
  decimals?: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeChain(value: string): string {
  return value.trim().toLowerCase();
}

function titleChain(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

const LOCAL_CHAIN = "solana";
const LOCAL_CHAIN_ID = 1;

const WORMHOLE_CHAIN_ID_BY_KEY: Record<string, number> = {
  solana: 1,
  ethereum: 2,
  bsc: 4,
  polygon: 5,
  avalanche: 6,
  arbitrum: 23,
  optimism: 24,
  base: 30
};

function chainKeyToId(chainKey: string): number | null {
  return WORMHOLE_CHAIN_ID_BY_KEY[chainKey] ?? null;
}

function toDirectionalRegistrations(
  parsed: unknown
): { ok: true; entries: MockDirectionalRegistration[] } | { ok: false; details: string } {
  const root = asObject(parsed);
  if (!root) {
    return { ok: false, details: "Mock fixture root must be an object." };
  }

  const registrationsRaw = root.registrations;
  if (!Array.isArray(registrationsRaw)) {
    return { ok: false, details: "Mock fixture must include registrations array." };
  }

  const entries: MockDirectionalRegistration[] = [];
  for (let idx = 0; idx < registrationsRaw.length; idx += 1) {
    const raw = registrationsRaw[idx];
    const item = asObject(raw);
    if (!item) {
      return { ok: false, details: `registrations[${idx}] must be an object.` };
    }

    if (
      typeof item.from !== "string" ||
      typeof item.to !== "string" ||
      typeof item.registered !== "boolean"
    ) {
      return {
        ok: false,
        details: `registrations[${idx}] requires string from/to and boolean registered fields.`
      };
    }

    entries.push({
      from: normalizeChain(item.from),
      to: normalizeChain(item.to),
      registered: item.registered,
      peerAddress: typeof item.peerAddress === "string" ? item.peerAddress : undefined,
      decimals: typeof item.decimals === "number" ? item.decimals : undefined
    });
  }

  return { ok: true, entries };
}

function evaluateSymmetryFromRegistrationMap(input: {
  expectedPeers: string[];
  localChain: string;
  registrationMap: Map<string, boolean>;
  source: string;
  retrievalMarker: string;
  rootCauseSummary: string;
}): Awaited<ReturnType<CheckDefinition["run"]>> | null {
  const { expectedPeers, localChain, registrationMap, source, retrievalMarker, rootCauseSummary } =
    input;

  for (const peerChain of expectedPeers) {
    const forwardKey = `${localChain}->${peerChain}`;
    const reverseKey = `${peerChain}->${localChain}`;
    const forward = registrationMap.get(forwardKey) ?? false;
    const reverse = registrationMap.get(reverseKey) ?? false;

    if (forward !== reverse) {
      const rootCauseLine = `${titleChain(localChain)}->${titleChain(peerChain)}: ${
        forward ? "REGISTERED" : "MISSING"
      } / ${titleChain(peerChain)}->${titleChain(localChain)}: ${
        reverse ? "REGISTERED" : "MISSING"
      }`;
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_REGISTRATION_ASYMMETRY",
        details: rootCauseLine,
        evidence: {
          summary: rootCauseSummary,
          data: {
            source,
            assertion_basis:
              "For each expected pair, registration must be symmetric in both directions.",
            observed: {
              checked_pair: `${localChain}<->${peerChain}`,
              first_failing_pair: `${localChain}<->${peerChain}`,
              forward_registered: forward,
              reverse_registered: reverse,
              root_cause_line: rootCauseLine
            },
            expected: {
              symmetric_registration: true
            },
            retrieval_marker: retrievalMarker,
            degradation: false
          }
        },
        degradation: false,
        source
      };
    }
  }

  return null;
}

export const peerRegistrationSymmetryMockCheck: CheckDefinition = {
  id: "CHK-007-peer-registration-symmetry-mock",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const configRead = await context.adapters.configSource.readConfig(context.options.configPath);
    if (!configRead.ok) {
      return {
        status: "SKIPPED",
        reason_code: configRead.reason_code,
        details: `Cannot compute expected peer pairs because config source is unavailable: ${configRead.details}`,
        evidence: {
          summary: "Expected peer pairs unavailable due to config source read failure.",
          data: {
            source: configRead.source_kind,
            assertion_basis: "Expected peer pairs come from top-level config peers mapping.",
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
        details: `Expected peer pair extraction failed: ${configParse.details}`,
        evidence: {
          summary: "Config parse failed before symmetry check.",
          data: {
            source: configRead.source_kind,
            assertion_basis: "Expected peer pairs are derived from top-level peers in config.",
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

    const configRoot = asObject(configParse.parsed);
    const peers = configRoot ? asObject(configRoot.peers) : null;
    if (!peers || Object.keys(peers).length === 0) {
      return {
        status: "FAIL",
        reason_code: "NTT_PEER_MAPPING_MISSING",
        details: "Cannot run symmetry check: config peers mapping is missing or empty.",
        evidence: {
          summary: "Symmetry check needs non-empty top-level peers mapping.",
          data: {
            source: configRead.source_kind,
            assertion_basis: "Expected checked pairs are localChain<->peer for every config peers key.",
            observed: {
              config_path: configRead.path,
              peers_present: Boolean(peers),
              peers_count: peers ? Object.keys(peers).length : 0
            },
            expected: {
              peers_count_min: 1
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const localChain = LOCAL_CHAIN;
    const expectedPeers = Object.keys(peers).map(normalizeChain);

    if (!context.options.mockChain) {
      const managerRaw = configRoot?.manager;
      const manager = asObject(managerRaw);
      const managerProgramId =
        manager && typeof manager.solanaProgramId === "string" ? manager.solanaProgramId.trim() : "";
      if (!managerProgramId) {
        return {
          status: "FAIL",
          reason_code: "NTT_MANAGER_PROGRAM_ID_MISSING",
          details: "Cannot run CHK-007 rpc mode: manager.solanaProgramId is missing in config.",
          evidence: {
            summary: "CHK-007 rpc mode requires manager.solanaProgramId.",
            data: {
              source: configRead.source_kind,
              assertion_basis:
                "RPC mode derives peer PDA by manager program id and chain identifier.",
              observed: {
                config_path: configRead.path,
                manager_solana_program_id_present: false
              },
              expected: {
                manager_solana_program_id_present: true
              },
              retrieval_marker: configRead.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "adapter/config-file"
        };
      }

      const registrationMap = new Map<string, boolean>();
      for (const peerChain of expectedPeers) {
        const peerChainId = chainKeyToId(peerChain);
        if (peerChainId === null) {
          return {
            status: "FAIL",
            reason_code: "NTT_CHAIN_ID_MAPPING_UNSUPPORTED",
            details: `Unsupported peer chain key '${peerChain}' for CHK-007 rpc mode chain-id mapping.`,
            evidence: {
              summary: "CHK-007 rpc mode could not derive chain identifier for peer key.",
              data: {
                source: "adapter/config-file",
                assertion_basis:
                  "RPC mode currently maps known top-level peers keys to Wormhole chain ids.",
                observed: {
                  peer_key: peerChain
                },
                expected: {
                  chain_id_mapping_available: true
                },
                retrieval_marker: configRead.retrieved_at,
                degradation: false
              }
            },
            degradation: false,
            source: "adapter/config-file"
          };
        }

        const forwardRead = await context.adapters.solanaRead.getPeerAccountExistence({
          manager_program_id: managerProgramId,
          chain_id: peerChainId
        });
        if (!forwardRead.ok) {
          return {
            status: "SKIPPED",
            reason_code: forwardRead.reason_code,
            details: `CHK-007 rpc mode read failed for ${localChain}->${peerChain}: ${forwardRead.details}`,
            evidence: {
              summary: "RPC source unavailable while reading peer registration existence.",
              data: {
                source: "adapter/solana-rpc",
                assertion_basis:
                  "CHK-007 rpc mode reads NTT peer PDA existence per direction from Solana RPC.",
                observed: {
                  checked_pair: `${localChain}<->${peerChain}`,
                  direction: `${localChain}->${peerChain}`,
                  chain_id: peerChainId
                },
                expected: {
                  rpc_readable: true
                },
                retrieval_marker: forwardRead.retrieved_at,
                degradation: true
              }
            },
            degradation: true,
            source: "adapter/solana-rpc"
          };
        }

        const reverseRead = await context.adapters.solanaRead.getPeerAccountExistence({
          manager_program_id: managerProgramId,
          chain_id: LOCAL_CHAIN_ID
        });
        if (!reverseRead.ok) {
          return {
            status: "SKIPPED",
            reason_code: reverseRead.reason_code,
            details: `CHK-007 rpc mode read failed for ${peerChain}->${localChain}: ${reverseRead.details}`,
            evidence: {
              summary: "RPC source unavailable while reading reverse-direction peer registration existence.",
              data: {
                source: "adapter/solana-rpc",
                assertion_basis:
                  "CHK-007 rpc mode reads NTT peer PDA existence per direction from Solana RPC.",
                observed: {
                  checked_pair: `${localChain}<->${peerChain}`,
                  direction: `${peerChain}->${localChain}`,
                  chain_id: LOCAL_CHAIN_ID
                },
                expected: {
                  rpc_readable: true
                },
                retrieval_marker: reverseRead.retrieved_at,
                degradation: true
              }
            },
            degradation: true,
            source: "adapter/solana-rpc"
          };
        }

        registrationMap.set(`${localChain}->${peerChain}`, forwardRead.exists);
        registrationMap.set(`${peerChain}->${localChain}`, reverseRead.exists);
      }

      const failed = evaluateSymmetryFromRegistrationMap({
        expectedPeers,
        localChain,
        registrationMap,
        source: "adapter/solana-rpc",
        retrievalMarker: new Date().toISOString(),
        rootCauseSummary: "Detected asymmetric peer registration state from rpc existence reads."
      });
      if (failed) {
        return failed;
      }

      return {
        status: "PASS",
        reason_code: null,
        details: "All expected peer pairs are symmetrically registered in rpc mode (existence-only).",
        evidence: {
          summary: "No asymmetry detected for expected peer registration pairs in rpc mode.",
          data: {
            source: "adapter/solana-rpc",
            assertion_basis:
              "For each expected pair, local->peer and peer->local existence states must match.",
            observed: {
              local_chain: localChain,
              mode: "rpc",
              checked_pairs: expectedPeers.map((peerChain) => `${localChain}<->${peerChain}`)
            },
            expected: {
              symmetric_registration: true
            },
            retrieval_marker: new Date().toISOString(),
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/solana-rpc"
      };
    }

    const mockRead = await context.adapters.configSource.readConfig(context.options.mockChainPath);
    if (!mockRead.ok) {
      return {
        status: "SKIPPED",
        reason_code: mockRead.reason_code,
        details: `Mock-chain fixture unavailable: ${mockRead.details}`,
        evidence: {
          summary: "Mock fixture could not be read.",
          data: {
            source: mockRead.source_kind,
            assertion_basis:
              "Symmetry requires directional registration states from mock fixture.",
            observed: {
              mock_chain_path: mockRead.path
            },
            expected: {
              mock_fixture_readable: true
            },
            retrieval_marker: mockRead.retrieved_at,
            degradation: true
          }
        },
        degradation: true,
        source: "mock-chain-fixture"
      };
    }

    const mockParse = context.adapters.configSource.parseConfig(mockRead.raw);
    if (!mockParse.ok) {
      return {
        status: "FAIL",
        reason_code: "MOCK_CHAIN_PARSE_ERROR",
        details: `Mock fixture parse failed: ${mockParse.details}`,
        evidence: {
          summary: "Mock fixture JSON parse failed before symmetry evaluation.",
          data: {
            source: mockRead.source_kind,
            assertion_basis:
              "Mock fixture must provide directional registrations for peer symmetry check.",
            observed: {
              mock_chain_path: mockRead.path
            },
            expected: {
              parseable_json: true
            },
            retrieval_marker: mockRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "mock-chain-fixture"
      };
    }

    const registrations = toDirectionalRegistrations(mockParse.parsed);
    if (!registrations.ok) {
      return {
        status: "FAIL",
        reason_code: "MOCK_CHAIN_FIXTURE_SHAPE_INVALID",
        details: registrations.details,
        evidence: {
          summary: "Mock fixture shape is invalid for symmetry check.",
          data: {
            source: mockRead.source_kind,
            assertion_basis:
              "Fixture schema: registrations[] with {from,to,registered} direction records.",
            observed: {
              mock_chain_path: mockRead.path
            },
            expected: {
              fixture_shape: "registrations[] objects with string from/to and boolean registered"
            },
            retrieval_marker: mockRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "mock-chain-fixture"
      };
    }

    const registrationMap = new Map<string, boolean>();
    for (const entry of registrations.entries) {
      registrationMap.set(`${entry.from}->${entry.to}`, entry.registered);
    }

    const failed = evaluateSymmetryFromRegistrationMap({
      expectedPeers,
      localChain,
      registrationMap,
      source: "mock-chain-fixture",
      retrievalMarker: mockRead.retrieved_at,
      rootCauseSummary: "Detected half-registered peer state in mock-chain fixture."
    });
    if (failed) {
      return failed;
    }

    return {
      status: "PASS",
      reason_code: null,
      details: "All expected peer pairs are symmetrically registered in mock-chain fixture.",
      evidence: {
        summary: "No asymmetry detected for expected peer registration pairs.",
        data: {
          source: "mock-chain-fixture",
          assertion_basis:
            "For each expected pair, local->peer and peer->local registration states must match.",
          observed: {
            local_chain: localChain,
            checked_pairs: expectedPeers.map((peerChain) => `${localChain}<->${peerChain}`)
          },
          expected: {
            symmetric_registration: true
          },
          retrieval_marker: mockRead.retrieved_at,
          degradation: false
        }
      },
      degradation: false,
      source: "mock-chain-fixture"
    };
  }
};
