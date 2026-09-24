import { apiUrl } from "@/src/lib/api/origin";
import { getInjectedDesktopConfig, localAuthHeaderName } from "@/src/lib/runtime/config";

export class ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  fields?: Record<string, string | string[]>;

  constructor(
    message: string,
    status: number,
    details?: { code?: string; requestId?: string; fields?: Record<string, string | string[]> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details?.code;
    this.requestId = details?.requestId;
    this.fields = details?.fields;
  }
}

type StructuredError = {
  code?: string;
  message?: string;
  error?: string;
  fields?: Record<string, string | string[]>;
  request_id?: string;
  requestId?: string;
};

async function readError(response: Response) {
  let details: StructuredError | undefined;
  try {
    details = (await response.json()) as StructuredError;
  } catch {
    // Ignore non-JSON error bodies.
  }
  const message =
    details?.message ||
    details?.error ||
    (response.status === 401
      ? "unauthorized"
      : response.status === 502 || response.status === 503
        ? "unable to connect to server"
        : response.status === 403
          ? "permission denied"
          : response.status === 404
            ? "file not found"
            : "request failed");
  return {
    message,
    code: details?.code,
    requestId: details?.request_id || details?.requestId || response.headers.get("X-Request-ID") || undefined,
    fields: details?.fields,
  };
}

const REQUEST_TIMEOUT_MS = 5000;

export type RequestOptions = RequestInit & {
  timeoutMs?: number;
  /** Porter mutation contract: retry-safe writes should carry an idempotency key. */
  idempotencyKey?: string;
  /** Porter optimistic concurrency contract. */
  ifMatch?: string;
  /** Correlates a UI action with backend logs and durable events. */
  requestId?: string;
};

export async function apiRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  if (init?.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
  if (init?.ifMatch) headers.set("If-Match", init.ifMatch);
  if (init?.requestId) headers.set("X-Request-ID", init.requestId);

  const token = getInjectedDesktopConfig()?.localAuthToken?.trim();
  if (token && !headers.has(localAuthHeaderName())) {
    headers.set(localAuthHeaderName(), token);
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (init?.signal) {
    if (init.signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    init.signal.addEventListener("abort", onParentAbort);
  }

  const timeoutMs = init?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchInit = { ...(init ?? {}) };
  delete (fetchInit as { timeoutMs?: number }).timeoutMs;
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...fetchInit,
      cache: "no-store",
      credentials: "omit",
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (init?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    const aborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    throw new ApiError(aborted ? "unable to connect to server" : "network disconnected", 0);
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", onParentAbort);
  }

  if (!response.ok) {
    const error = await readError(response);
    throw new ApiError(error.message, response.status, error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
