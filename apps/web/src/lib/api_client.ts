import { api_error_schema } from "@voita_kone/shared_types";
import type { z } from "zod";
import { clear_session_token, read_session_token } from "./session";

/** An error answer from our API ({ error: { code, message } }) or a failed request. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly http_status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function get_api_base_url(): string {
  const api_base_url = import.meta.env.VITE_API_BASE_URL;
  if (!api_base_url) {
    throw new Error("VITE_API_BASE_URL is not set. Check your .env file.");
  }
  return api_base_url.replace(/\/+$/, "");
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function to_api_error(response: Response, method: Method, path: string): Promise<ApiError> {
  const parsed = api_error_schema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    return new ApiError(parsed.data.error.code, response.status, parsed.data.error.message);
  }
  return new ApiError(
    "HTTP_ERROR",
    response.status,
    `${method} ${path} failed (${String(response.status)})`,
  );
}

async function send(method: Method, path: string, body: unknown, token: string | null) {
  const headers: Record<string, string> = {};
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  try {
    return await fetch(`${get_api_base_url()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", 0, "Could not reach the server");
  }
}

/**
 * Calls a path under /api/v1 with the session token (if any) and validates the body with the
 * shared zod schema. A 401 for a stored token means it is no longer valid: the token is
 * cleared, and a GET is tried once more without it (public data still loads).
 */
export async function api_request<T extends z.ZodType>(
  method: Method,
  path: string,
  schema: T,
  body?: unknown,
): Promise<z.infer<T>> {
  const token = read_session_token();
  let response = await send(method, path, body, token);
  if (response.status === 401 && token !== null) {
    clear_session_token();
    if (method === "GET") {
      response = await send(method, path, body, null);
    }
  }
  if (!response.ok) {
    throw await to_api_error(response, method, path);
  }
  // 204 No Content (e.g. a DELETE) has no JSON body.
  return schema.parse(response.status === 204 ? null : await response.json());
}

/** GET a path under /api/v1 and validate the body with the shared zod schema. */
export function api_get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  return api_request("GET", path, schema);
}

/** True when the endpoint does not exist yet (route-level 404), not when an item is missing. */
export function is_missing_endpoint(error: unknown): boolean {
  return error instanceof ApiError && error.http_status === 404 && error.code === "NOT_FOUND";
}

const warned_labels = new Set<string>();

/** Logs a console warning once per label (e.g. once per endpoint). */
export function warn_once(label: string, message: string): void {
  if (warned_labels.has(label)) {
    return;
  }
  warned_labels.add(label);
  console.warn(message);
}

/** True when the endpoint itself failed (unreachable or a server error), not a known answer. */
export function is_endpoint_failure(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "NETWORK_ERROR" || error.http_status >= 500);
}

/**
 * Real API first. When an endpoint is not built yet (404 NOT_FOUND) or fails (network,
 * 5xx), use sample data for that part and say so once in the console. Known answers such as
 * GAME_NOT_FOUND or PREDICTION_NOT_READY are passed on to the caller.
 */
export async function get_or_sample<T extends z.ZodType>(
  path: string,
  schema: T,
  endpoint_label: string,
  build_sample: () => z.infer<T> | Promise<z.infer<T>>,
): Promise<z.infer<T>> {
  try {
    return await api_get(path, schema);
  } catch (error) {
    if (is_missing_endpoint(error)) {
      warn_once(endpoint_label, `${endpoint_label} is not built yet: showing sample data.`);
      return build_sample();
    }
    if (is_endpoint_failure(error)) {
      warn_once(
        endpoint_label,
        `${endpoint_label} failed (${String(error)}): showing sample data.`,
      );
      return build_sample();
    }
    throw error;
  }
}
