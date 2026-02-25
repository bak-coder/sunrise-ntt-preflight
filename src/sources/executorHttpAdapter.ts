import {
  ExecutorCapabilitiesReadInput,
  ExecutorCapabilitiesReadResult,
  ExecutorEndpointReachabilityInput,
  ExecutorEndpointReachabilityResult,
  ExecutorHttpAdapter
} from "./contracts";

interface ExecutorHttpAdapterOptions {
  timeoutMs?: number;
}

function buildRequestId(): string {
  return `executor-reachability-${Date.now()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function resolveMockStatus(endpoint: string): number | null {
  if (
    endpoint === "mock://executor/reachable" ||
    endpoint === "mock://executor/capabilities/valid" ||
    endpoint === "mock://executor/capabilities/missing-field" ||
    endpoint === "mock://executor/capabilities/invalid-json"
  ) {
    return 200;
  }
  if (endpoint === "mock://executor/unreachable") {
    return 503;
  }
  const matched = endpoint.match(/^mock:\/\/executor\/status\/(\d{3})$/);
  if (!matched) {
    return null;
  }
  const parsed = Number(matched[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function resolveMockCapabilitiesPayload(endpoint: string): string | null {
  if (endpoint === "mock://executor/reachable" || endpoint === "mock://executor/capabilities/valid") {
    return JSON.stringify({
      supported_chains: ["Solana", "Base"],
      supported_relay_types: ["ERN1"],
      status: "active"
    });
  }
  if (endpoint === "mock://executor/capabilities/missing-field") {
    return JSON.stringify({
      supported_chains: ["Solana", "Base"],
      status: "active"
    });
  }
  if (endpoint === "mock://executor/capabilities/invalid-json") {
    return "{invalid-json";
  }
  return null;
}

export class ExecutorHttpReachabilityAdapter implements ExecutorHttpAdapter {
  private timeoutMs: number;

  constructor(options: ExecutorHttpAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async readRealGet(input: {
    endpoint: string;
    path: string;
    retrieved_at: string;
    request_id: string;
  }): Promise<
    | {
        ok: true;
        request_url: string;
        http_status: number;
        payload_raw: string;
      }
    | {
        ok: false;
        request_url: string | null;
        reason_code: "EXECUTOR_ENDPOINT_INVALID" | "EXECUTOR_HTTP_TIMEOUT" | "EXECUTOR_HTTP_UNAVAILABLE";
        details: string;
      }
  > {
    let request_url: string;
    try {
      request_url = new URL(input.path, input.endpoint).toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        request_url: null,
        reason_code: "EXECUTOR_ENDPOINT_INVALID",
        details: message
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(request_url, {
        method: "GET",
        signal: controller.signal
      });
      const payload_raw = await response.text();
      return {
        ok: true,
        request_url,
        http_status: response.status,
        payload_raw
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          request_url,
          reason_code: "EXECUTOR_HTTP_TIMEOUT",
          details: `Executor HTTP timeout after ${this.timeoutMs}ms.`
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        request_url,
        reason_code: "EXECUTOR_HTTP_UNAVAILABLE",
        details: message
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getEndpointReachability(
    input: ExecutorEndpointReachabilityInput
  ): Promise<ExecutorEndpointReachabilityResult> {
    const retrieved_at = new Date().toISOString();
    const request_id = buildRequestId();
    const healthPath = input.health_path ?? "/";
    if (!input.endpoint) {
      return {
        ok: false,
        mode: input.mock_mode ? "mock" : "real",
        endpoint: null,
        request_url: null,
        retrieved_at,
        request_id,
        reason_code: "EXECUTOR_ENDPOINT_NOT_CONFIGURED",
        details: "Executor endpoint is not configured.",
        degradation: true
      };
    }

    if (input.mock_mode) {
      const status = resolveMockStatus(input.endpoint);
      if (status === null) {
        return {
          ok: false,
          mode: "mock",
          endpoint: input.endpoint,
          request_url: input.endpoint,
          retrieved_at,
          request_id,
          reason_code: "EXECUTOR_MOCK_RESPONSE_INVALID",
          details:
            "Mock endpoint must be one of: mock://executor/reachable, mock://executor/unreachable, mock://executor/status/<code>.",
          degradation: true
        };
      }
      return {
        ok: true,
        mode: "mock",
        endpoint: input.endpoint,
        request_url: input.endpoint,
        retrieved_at,
        request_id,
        http_status: status,
        reachable: status >= 200 && status <= 299
      };
    }

    const real = await this.readRealGet({
      endpoint: input.endpoint,
      path: healthPath,
      retrieved_at,
      request_id
    });
    if (!real.ok) {
      return {
        ok: false,
        mode: "real",
        endpoint: input.endpoint,
        request_url: real.request_url,
        retrieved_at,
        request_id,
        reason_code: real.reason_code,
        details: real.details,
        degradation: true
      };
    }

    return {
      ok: true,
      mode: "real",
      endpoint: input.endpoint,
      request_url: real.request_url,
      retrieved_at,
      request_id,
      http_status: real.http_status,
      reachable: real.http_status >= 200 && real.http_status <= 299
    };
  }

  async getRelayCapabilities(
    input: ExecutorCapabilitiesReadInput
  ): Promise<ExecutorCapabilitiesReadResult> {
    const retrieved_at = new Date().toISOString();
    const request_id = buildRequestId();
    const capabilitiesPath = input.capabilities_path ?? "/v0/capabilities";
    if (!input.endpoint) {
      return {
        ok: false,
        mode: input.mock_mode ? "mock" : "real",
        endpoint: null,
        request_url: null,
        retrieved_at,
        request_id,
        reason_code: "EXECUTOR_ENDPOINT_NOT_CONFIGURED",
        details: "Executor endpoint is not configured.",
        degradation: true
      };
    }

    if (input.mock_mode) {
      const mockPayload = resolveMockCapabilitiesPayload(input.endpoint);
      if (mockPayload === null) {
        return {
          ok: false,
          mode: "mock",
          endpoint: input.endpoint,
          request_url: input.endpoint,
          retrieved_at,
          request_id,
          reason_code: "EXECUTOR_MOCK_RESPONSE_INVALID",
          details:
            "Mock capabilities endpoint must be one of: mock://executor/capabilities/valid, mock://executor/capabilities/missing-field, mock://executor/capabilities/invalid-json, or mock://executor/reachable.",
          degradation: true
        };
      }

      try {
        const parsed = JSON.parse(mockPayload) as unknown;
        return {
          ok: true,
          mode: "mock",
          endpoint: input.endpoint,
          request_url: input.endpoint,
          retrieved_at,
          request_id,
          http_status: 200,
          payload_raw: mockPayload,
          payload_json: parsed,
          parseable_json: true
        };
      } catch {
        return {
          ok: true,
          mode: "mock",
          endpoint: input.endpoint,
          request_url: input.endpoint,
          retrieved_at,
          request_id,
          http_status: 200,
          payload_raw: mockPayload,
          payload_json: null,
          parseable_json: false
        };
      }
    }

    const real = await this.readRealGet({
      endpoint: input.endpoint,
      path: capabilitiesPath,
      retrieved_at,
      request_id
    });
    if (!real.ok) {
      return {
        ok: false,
        mode: "real",
        endpoint: input.endpoint,
        request_url: real.request_url,
        retrieved_at,
        request_id,
        reason_code: real.reason_code,
        details: real.details,
        degradation: true
      };
    }

    try {
      const parsed = JSON.parse(real.payload_raw) as unknown;
      return {
        ok: true,
        mode: "real",
        endpoint: input.endpoint,
        request_url: real.request_url,
        retrieved_at,
        request_id,
        http_status: real.http_status,
        payload_raw: real.payload_raw,
        payload_json: parsed,
        parseable_json: true
      };
    } catch {
      return {
        ok: true,
        mode: "real",
        endpoint: input.endpoint,
        request_url: real.request_url,
        retrieved_at,
        request_id,
        http_status: real.http_status,
        payload_raw: real.payload_raw,
        payload_json: null,
        parseable_json: false
      };
    }
  }
}
