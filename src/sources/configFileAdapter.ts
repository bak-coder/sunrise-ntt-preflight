import { readFile } from "node:fs/promises";
import { ConfigParseResult, ConfigReadResult, ConfigSourceAdapter } from "./contracts";

function formatFsError(error: unknown): string {
  const value = error as NodeJS.ErrnoException;
  if (!value) {
    return "Unknown file system error.";
  }
  return `${value.code ?? "ERR_UNKNOWN"}: ${value.message ?? "Unknown error"}`;
}

export class ConfigFileAdapter implements ConfigSourceAdapter {
  async readConfig(path: string): Promise<ConfigReadResult> {
    const retrieved_at = new Date().toISOString();
    try {
      const raw = await readFile(path, "utf8");
      return {
        ok: true as const,
        source_kind: "config-file",
        path,
        retrieved_at,
        raw
      };
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      const reason_code = fsError?.code === "ENOENT" ? "CONFIG_NOT_FOUND" : "CONFIG_UNREADABLE";
      return {
        ok: false as const,
        source_kind: "config-file",
        path,
        retrieved_at,
        reason_code,
        details: formatFsError(error),
        degradation: true
      };
    }
  }

  parseConfig(raw: string): ConfigParseResult {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return {
        ok: true as const,
        parsed
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false as const,
        reason_code: "CONFIG_PARSE_ERROR" as const,
        details: message
      };
    }
  }
}
