import type { ErrorRequestHandler } from "express";
import type { ApiError } from "@voita_kone/shared_types";
import { ZodError, z } from "zod";
import { AppError } from "./app_error";
import type { Logger } from "./logger";

// express.json() throws this kind of error for a malformed body.
function is_body_parse_error(error: unknown): boolean {
  return error instanceof SyntaxError && "type" in error && error.type === "entity.parse.failed";
}

export function create_error_middleware(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    let http_status = 500;
    let body: ApiError = {
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    };

    if (error instanceof AppError) {
      http_status = error.http_status;
      body = { error: { code: error.code, message: error.message } };
    } else if (error instanceof ZodError) {
      http_status = 400;
      body = { error: { code: "VALIDATION_ERROR", message: z.prettifyError(error) } };
    } else if (is_body_parse_error(error)) {
      http_status = 400;
      body = { error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } };
    }

    if (http_status >= 500) {
      logger.error({ err: error, request_id: req.id }, "Unhandled error");
    }

    res.status(http_status).json(body);
  };
}
