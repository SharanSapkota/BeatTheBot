import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "X-Request-Id";
const valid_request_id_pattern = /^[\w-]{1,100}$/;

// Reuses a safe incoming X-Request-Id (e.g. from a proxy) or creates a new one.
export const request_id_middleware: RequestHandler = (req, res, next) => {
  const incoming_request_id = req.get(REQUEST_ID_HEADER);
  const request_id =
    incoming_request_id && valid_request_id_pattern.test(incoming_request_id)
      ? incoming_request_id
      : randomUUID();

  req.id = request_id;
  res.setHeader(REQUEST_ID_HEADER, request_id);
  next();
};
