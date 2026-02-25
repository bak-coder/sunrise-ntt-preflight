import { CheckDefinition } from "../types";

interface MockDirectionalRegistration {
  from: string;
  to: string;
  registered: boolean;
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
      decimals: typeof item.decimals === "number" ? item.decimals : undefined
    });
  }

  return { ok: true, entries };
}

export const decimalsSyncMockCheck: CheckDefinition = {
  id: "CHK-008-decimals-sync-mock",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    if (!context.options.mockChain) {
      return {
        status: "SKIPPED",
        reason_code: "MOCK_CHAIN_DISABLED",
        details: "CHK-008 runs only in --mock-chain mode for this iteration.",
        evidence: {
          summary: "Mock-chain mode is disabled; decimals-sync mock check not executed.",
          data: {
            source: "mock-chain-fixture",
            assertion_basis: "Decimals sync is validated from mock fixture in iteration 3.2.",
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
          summary: "Config parse failed before decimals-sync check.",
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
        details: "Cannot run decimals-sync check: config peers mapping is missing or empty.",
        evidence: {
          summary: "Decimals-sync check needs non-empty top-level peers mapping.",
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
              "Decimals sync requires directional registration decimals from mock fixture.",
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
          summary: "Mock fixture JSON parse failed before decimals comparison.",
          data: {
            source: mockRead.source_kind,
            assertion_basis:
              "Mock fixture must provide directional registrations for decimals comparison.",
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
          summary: "Mock fixture shape is invalid for decimals-sync check.",
          data: {
            source: mockRead.source_kind,
            assertion_basis:
              "Fixture schema: registrations[] with {from,to,registered,decimals?} records.",
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

    const registrationMap = new Map<string, MockDirectionalRegistration>();
    for (const entry of registrations.entries) {
      registrationMap.set(`${entry.from}->${entry.to}`, entry);
    }

    for (const peerChain of expectedPeers) {
      const forwardKey = `${localChain}->${peerChain}`;
      const reverseKey = `${peerChain}->${localChain}`;
      const forward = registrationMap.get(forwardKey);
      const reverse = registrationMap.get(reverseKey);

      if (!forward || !reverse || !forward.registered || !reverse.registered) {
        return {
          status: "FAIL",
          reason_code: "NTT_DECIMALS_REGISTRATION_MISSING",
          details: `Missing required registration record(s) for decimals comparison: ${titleChain(
            localChain
          )}<->${titleChain(peerChain)}`,
          evidence: {
            summary: "Cannot compare decimals because directional registration record is missing.",
            data: {
              source: "mock-chain-fixture",
              assertion_basis: "Both directions must have registered records before decimals comparison.",
              observed: {
                checked_pair: `${localChain}<->${peerChain}`,
                forward_present: Boolean(forward),
                reverse_present: Boolean(reverse),
                forward_registered: forward?.registered ?? null,
                reverse_registered: reverse?.registered ?? null
              },
              expected: {
                forward_registered: true,
                reverse_registered: true
              },
              retrieval_marker: mockRead.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "mock-chain-fixture"
        };
      }

      if (typeof forward.decimals !== "number" || typeof reverse.decimals !== "number") {
        return {
          status: "FAIL",
          reason_code: "NTT_DECIMALS_REGISTRATION_MISSING",
          details: `Missing decimals metadata for comparison at pair ${titleChain(
            localChain
          )}<->${titleChain(peerChain)}`,
          evidence: {
            summary: "Directional registrations exist but decimals metadata is incomplete.",
            data: {
              source: "mock-chain-fixture",
              assertion_basis: "Both directional registrations must provide decimals for comparison.",
              observed: {
                checked_pair: `${localChain}<->${peerChain}`,
                forward_decimals: forward.decimals ?? null,
                reverse_decimals: reverse.decimals ?? null
              },
              expected: {
                forward_decimals_type: "number",
                reverse_decimals_type: "number"
              },
              retrieval_marker: mockRead.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "mock-chain-fixture"
        };
      }

      if (forward.decimals !== reverse.decimals) {
        const rootCauseLine = `${titleChain(localChain)}->${titleChain(peerChain)} decimals=${
          forward.decimals
        } / ${titleChain(peerChain)}->${titleChain(localChain)} decimals=${
          reverse.decimals
        } (MISMATCH)`;
        return {
          status: "FAIL",
          reason_code: "NTT_DECIMALS_MISMATCH",
          details: rootCauseLine,
          evidence: {
            summary: "Detected decimals mismatch across registration directions.",
            data: {
              source: "mock-chain-fixture",
              assertion_basis: "Directional registration decimals must be equal for each expected pair.",
              observed: {
                checked_pair: `${localChain}<->${peerChain}`,
                first_failing_pair: `${localChain}<->${peerChain}`,
                forward_decimals: forward.decimals,
                reverse_decimals: reverse.decimals,
                root_cause_line: rootCauseLine
              },
              expected: {
                decimals_equal: true
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
      details: "All expected peer pairs have matching decimals in mock-chain fixture.",
      evidence: {
        summary: "No decimals mismatch detected for expected peer registration pairs.",
        data: {
          source: "mock-chain-fixture",
          assertion_basis:
            "Directional registration decimals must be equal for each expected pair.",
          observed: {
            local_chain: localChain,
            checked_pairs: expectedPeers.map((peerChain) => `${localChain}<->${peerChain}`)
          },
          expected: {
            decimals_equal: true
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
