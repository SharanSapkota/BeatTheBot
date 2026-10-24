import { api_error_schema } from "@voita_kone/shared_types";
import type { z } from "zod";

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

async function to_api_error(response: Response, path: string): Promise<ApiError> {
  const parsed = api_error_schema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    return new ApiError(parsed.data.error.code, response.status, parsed.data.error.message);
  }
  return new ApiError(
    "HTTP_ERROR",
    response.status,
    `GET ${path} failed (${String(response.status)})`,
  );
}

/** GET a path under /api/v1 and validate the body with the shared zod schema. */
export async function api_get<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  let response: Response;
  try {
    response = await fetch(`${get_api_base_url()}${path}`);
  } catch {
    throw new ApiError("NETWORK_ERROR", 0, "Could not reach the server");
  }
  if (!response.ok) {
    throw await to_api_error(response, path);
  }
  return schema.parse(await response.json());
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

/**
 * Real API first. While an endpoint is not built yet (404 NOT_FOUND), use sample data
 * for that part and say so once in the console.
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
    if (!is_missing_endpoint(error)) {
      throw error;
    }
    warn_once(endpoint_label, `${endpoint_label} is not built yet: showing sample data.`);
    return build_sample();
  }
}
