import type { RequestHandler } from "express";
import { AppError } from "./app_error";

export const not_found_middleware: RequestHandler = (req, _res, next) => {
  next(new AppError("NOT_FOUND", 404, `Route not found: ${req.method} ${req.path}`));
};
