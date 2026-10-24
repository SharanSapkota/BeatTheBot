import type { RequestHandler } from "express";
import {
  admin_match_input_schema,
  admin_match_result_input_schema,
  sport_schema,
  type AdminLeague,
  type AdminMatch,
  type ApiSuccess,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { AppError } from "../../common/app_error";
import { require_role } from "../auth/auth_context";
import type { AdminMatchesService } from "./admin_matches_service";

const ADMIN_ROLES = ["admin"] as const;
const match_params_schema = z.object({ match_id: z.string() });
const list_query_schema = z.object({ sport: sport_schema.optional() });

/** A malformed id can't match any match. */
function parse_match_id(params: unknown): string {
  const { match_id } = match_params_schema.parse(params);
  if (!z.uuid().safeParse(match_id).success) {
    throw new AppError("MATCH_NOT_FOUND", 404, `No match ${match_id}`);
  }
  return match_id;
}

function send(res: Parameters<RequestHandler>[1], data: AdminMatch, status = 200): void {
  const response: ApiSuccess<AdminMatch> = { data };
  res.status(status).set("Cache-Control", "no-store").json(response);
}

/** /admin/leagues and /admin/matches: require_role('admin') on every route. */
export class AdminMatchesController {
  constructor(private readonly service: AdminMatchesService) {}

  list_leagues: RequestHandler = async (req, res) => {
    require_role(req, ADMIN_ROLES);
    const response: ApiSuccess<AdminLeague[]> = { data: await this.service.list_leagues() };
    res.set("Cache-Control", "no-store").json(response);
  };

  list_matches: RequestHandler = async (req, res) => {
    require_role(req, ADMIN_ROLES);
    const { sport } = list_query_schema.parse(req.query);
    const response: ApiSuccess<AdminMatch[]> = { data: await this.service.list_matches(sport) };
    res.set("Cache-Control", "no-store").json(response);
  };

  create: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const input = admin_match_input_schema.parse(req.body);
    send(res, await this.service.create(user_id, input), 201);
  };

  update: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const match_id = parse_match_id(req.params);
    const input = admin_match_input_schema.parse(req.body);
    send(res, await this.service.update(user_id, match_id, input));
  };

  delete: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    await this.service.delete(user_id, parse_match_id(req.params));
    res.status(204).end();
  };

  save_result: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const match_id = parse_match_id(req.params);
    const result = admin_match_result_input_schema.parse(req.body);
    send(res, await this.service.save_result(user_id, match_id, result));
  };
}
