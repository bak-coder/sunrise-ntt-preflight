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

export const peerRegistrationSymmetryMockCheck: CheckDefinition = {
  id: "CHK-007-peer-registration-symmetry-mock",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    if (!context.options.mockChain) {
      return {
        status: "SKIPPED",
        reason_code: "MOCK_CHAIN_DISABLED",
        details: "CHK-007 runs only in --mock-chain mode for this iteration.",
        evidence: {
          summary: "Mock-chain mode is disabled; symmetry check not executed.",
          data: {
            source: "mock-chain-fixture",
            assertion_basis: "Peer registration symmetry is validated only from mock fixture in iteration 3.1.",
            observed: {
              mock_chain_enabled: false,
              mock_chain_path: context.options.mockChainPath
            },
            expected: {
              mock_chain_enabled: true
            },
            retrieval_marker: new Date().toISOString(),
            degradation: true
          }
        },
        degradation: true,
        source: "mock-chain-fixture"
      };
    }

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

    const localChain = "solana";
    const expectedPeers = Object.keys(peers).map(normalizeChain);

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
            summary: "Detected half-registered peer state in mock-chain fixture.",
            data: {
              source: "mock-chain-fixture",
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
              retrieval_marker: mockRead.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "mock-chain-fixture"
        };
      }
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
