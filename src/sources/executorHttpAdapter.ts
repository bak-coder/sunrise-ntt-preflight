import {
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
  if (endpoint === "mock://executor/reachable") {
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

export class ExecutorHttpReachabilityAdapter implements ExecutorHttpAdapter {
  private timeoutMs: number;

  constructor(options: ExecutorHttpAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000;
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

    let requestUrl: string;
    try {
      requestUrl = new URL(healthPath, input.endpoint).toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        mode: "real",
        endpoint: input.endpoint,
        request_url: null,
        retrieved_at,
        request_id,
        reason_code: "EXECUTOR_ENDPOINT_INVALID",
        details: message,
        degradation: true
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        signal: controller.signal
      });
      return {
        ok: true,
        mode: "real",
        endpoint: input.endpoint,
        request_url: requestUrl,
        retrieved_at,
        request_id,
        http_status: response.status,
        reachable: response.status >= 200 && response.status <= 299
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          mode: "real",
          endpoint: input.endpoint,
          request_url: requestUrl,
          retrieved_at,
          request_id,
          reason_code: "EXECUTOR_HTTP_TIMEOUT",
          details: `Executor reachability timeout after ${this.timeoutMs}ms.`,
          degradation: true
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        mode: "real",
        endpoint: input.endpoint,
        request_url: requestUrl,
        retrieved_at,
        request_id,
        reason_code: "EXECUTOR_HTTP_UNAVAILABLE",
        details: message,
        degradation: true
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
