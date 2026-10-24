import { z } from "zod";

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const api_error_schema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export function api_success_schema<T extends z.ZodType>(data_schema: T) {
  return z.object({ data: data_schema });
}

export const health_data_schema = z.object({
  status: z.literal("ok"),
  time: z.iso.datetime(),
});

export const health_response_schema = api_success_schema(health_data_schema);

export type HealthData = z.infer<typeof health_data_schema>;
export type HealthResponse = z.infer<typeof health_response_schema>;
