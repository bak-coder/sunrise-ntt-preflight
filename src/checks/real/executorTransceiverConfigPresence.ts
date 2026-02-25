import { CheckDefinition } from "../types";

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readEntryReference(entry: unknown): { ok: true; ref: string } | { ok: false; details: string } {
  if (typeof entry === "string") {
    const ref = entry.trim();
    if (ref.length === 0) {
      return { ok: false, details: "string entry must be non-empty after trim" };
    }
    return { ok: true, ref };
  }

  const obj = asObject(entry);
  if (!obj) {
    return { ok: false, details: "entry must be string or object with address/reference" };
  }

  const address = typeof obj.address === "string" ? obj.address.trim() : "";
  const reference = typeof obj.reference === "string" ? obj.reference.trim() : "";
  const ref = address.length > 0 ? address : reference;
  if (ref.length === 0) {
    return { ok: false, details: "object entry must include non-empty address or reference string" };
  }

  return { ok: true, ref };
}

export const executorTransceiverConfigPresenceCheck: CheckDefinition = {
  id: "CHK-011-executor-transceiver-config-presence",
  severity_class: "blocking",
  deterministic: true,
  async run(context) {
    const configRead = await context.adapters.configSource.readConfig(context.options.configPath);
    if (!configRead.ok) {
      return {
        status: "SKIPPED",
        reason_code: configRead.reason_code,
        details: `Executor transceiver config presence skipped: ${configRead.details}`,
        evidence: {
          summary: "Config source unavailable for executor transceiver config presence check.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Executor transceiver config presence requires readable config intent source.",
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
        details: `Executor transceiver config parse failed: ${configParse.details}`,
        evidence: {
          summary: "Config parse failed before executor transceiver config presence evaluation.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Executor transceiver config presence requires parseable config JSON.",
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
    const executorSection = root ? asObject(root.executor) : null;
    if (!executorSection) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_TRANSCEIVER_CONFIG_MISSING",
        details: "Missing required executor config section.",
        evidence: {
          summary: "Executor config section is missing.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Config must include executor section with transceiverAddress and transceivers entries.",
            observed: {
              has_executor_section: false
            },
            expected: {
              has_executor_section: true
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const requiredReferenceRaw =
      typeof executorSection.transceiverAddress === "string"
        ? executorSection.transceiverAddress
        : typeof executorSection.transceiverReference === "string"
          ? executorSection.transceiverReference
          : "";
    const requiredReference = requiredReferenceRaw.trim();
    if (requiredReference.length === 0) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_TRANSCEIVER_REFERENCE_MISSING",
        details:
          "Missing required executor transceiver reference (executor.transceiverAddress or executor.transceiverReference).",
        evidence: {
          summary: "Executor transceiver required reference is missing.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Config must include expected executor transceiver reference to validate presence.",
            observed: {
              has_transceiver_address: typeof executorSection.transceiverAddress === "string",
              has_transceiver_reference: typeof executorSection.transceiverReference === "string"
            },
            expected: {
              required_reference_present: true
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const transceiversRaw = executorSection.transceivers;
    if (!Array.isArray(transceiversRaw)) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_TRANSCEIVER_CONFIG_MISSING",
        details: "Missing required executor.transceivers array.",
        evidence: {
          summary: "Executor transceivers section is missing or not an array.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "Config must include executor.transceivers array for transceiver presence verification.",
            observed: {
              transceivers_type: typeof transceiversRaw,
              transceivers_is_array: Array.isArray(transceiversRaw)
            },
            expected: {
              transceivers_type: "array"
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    if (transceiversRaw.length === 0) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_TRANSCEIVER_CONFIG_EMPTY",
        details: "executor.transceivers array is empty.",
        evidence: {
          summary: "Executor transceivers section exists but has no entries.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "At least one transceiver entry must be present before checking required executor reference.",
            observed: {
              transceivers_count: 0
            },
            expected: {
              transceivers_count_min: 1
            },
            retrieval_marker: configRead.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const extractedRefs: string[] = [];
    for (let idx = 0; idx < transceiversRaw.length; idx += 1) {
      const entry = transceiversRaw[idx];
      const parsedEntry = readEntryReference(entry);
      if (!parsedEntry.ok) {
        return {
          status: "FAIL",
          reason_code: "EXECUTOR_TRANSCEIVER_CONFIG_SHAPE_INVALID",
          details: `Invalid executor.transceivers[${idx}] shape: ${parsedEntry.details}.`,
          evidence: {
            summary: "Executor transceiver entry has invalid minimal shape.",
            data: {
              source: configRead.source_kind,
              assertion_basis:
                "Each transceiver entry must be string or object with non-empty address/reference.",
              observed: {
                invalid_index: idx
              },
              expected: {
                entry_shape: "string | { address: string } | { reference: string }"
              },
              retrieval_marker: configRead.retrieved_at,
              degradation: false
            }
          },
          degradation: false,
          source: "adapter/config-file"
        };
      }
      extractedRefs.push(parsedEntry.ref);
    }

    const present = extractedRefs.includes(requiredReference);
    if (!present) {
      return {
        status: "FAIL",
        reason_code: "EXECUTOR_TRANSCEIVER_NOT_PRESENT",
        details: `Required executor transceiver reference '${requiredReference}' is not present in executor.transceivers.`,
        evidence: {
          summary: "Required executor transceiver reference is missing from transceivers list.",
          data: {
            source: configRead.source_kind,
            assertion_basis:
              "executor.transceivers must include the required executor transceiver reference from config.",
            observed: {
              required_reference: requiredReference,
              available_references: extractedRefs
            },
            expected: {
              required_reference_present: true
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
      details: `Executor transceiver config presence confirmed: '${requiredReference}' is present.`,
      evidence: {
        summary: "Executor transceiver config contains the required executor transceiver reference.",
        data: {
          source: configRead.source_kind,
          assertion_basis:
            "executor.transceivers must include executor.transceiverAddress/reference value.",
          observed: {
            required_reference: requiredReference,
            transceivers_count: extractedRefs.length
          },
          expected: {
            required_reference_present: true
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
