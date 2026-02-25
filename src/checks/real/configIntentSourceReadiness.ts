import { CheckDefinition } from "../types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const configIntentSourceReadinessCheck: CheckDefinition = {
  id: "CHK-001-config-intent-source-readiness",
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
        details: `Config source unavailable: ${readResult.details}`,
        evidence: {
          summary: "Config intent source could not be read.",
          data: {
            source: readResult.source_kind,
            observed: {
              config_path: readResult.path
            },
            assertion_basis: "Config file must be present and readable.",
            retrieval_marker: readResult.retrieved_at,
            degradation: readResult.degradation
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
        details: `Config parse failed: ${parseResult.details}`,
        evidence: {
          summary: "Config intent source is readable but not parseable JSON.",
          data: {
            source: readResult.source_kind,
            observed: {
              config_path: readResult.path,
              raw_bytes: Buffer.byteLength(readResult.raw, "utf8")
            },
            assertion_basis: "Config file must be parseable JSON.",
            retrieval_marker: readResult.retrieved_at,
            degradation: false
          }
        },
        degradation: false,
        source: "adapter/config-file"
      };
    }

    const parsed = parseResult.parsed;
    const topLevelKeys = isObject(parsed) ? Object.keys(parsed) : [];
    return {
      status: "PASS",
      reason_code: null,
      details: "Config source is present, readable, and parseable JSON.",
      evidence: {
        summary: "Config intent source readiness confirmed.",
        data: {
          source: readResult.source_kind,
          observed: {
            config_path: readResult.path,
            raw_bytes: Buffer.byteLength(readResult.raw, "utf8"),
            top_level_keys_count: topLevelKeys.length
          },
          assertion_basis: "Config file is required as deterministic intent source.",
          retrieval_marker: readResult.retrieved_at,
          degradation: false
        }
      },
      degradation: false,
      source: "adapter/config-file"
    };
  }
};
