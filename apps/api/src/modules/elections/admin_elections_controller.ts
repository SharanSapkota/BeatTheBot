import type { RequestHandler } from "express";
import {
  admin_candidate_request_schema,
  admin_election_request_schema,
  admin_result_request_schema,
  type AdminElection,
  type ApiSuccess,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { AppError } from "../../common/app_error";
import { require_role } from "../auth/auth_context";
import type { AdminElectionsService } from "./admin_elections_service";
import { parse_election_id } from "./elections_controller";

const ADMIN_ROLES = ["admin"] as const;
const candidate_params_schema = z.object({ candidate_id: z.string() });

function parse_candidate_id(params: unknown): string {
  const { candidate_id } = candidate_params_schema.parse(params);
  if (!z.uuid().safeParse(candidate_id).success) {
    throw new AppError("CANDIDATE_NOT_FOUND", 404, `No candidate ${candidate_id}`);
  }
  return candidate_id;
}

function send(res: Parameters<RequestHandler>[1], data: AdminElection, status = 200): void {
  const response: ApiSuccess<AdminElection> = { data };
  res.status(status).set("Cache-Control", "no-store").json(response);
}

/** /admin/elections: require_role('admin') on every route (401 anonymous, 403 otherwise). */
export class AdminElectionsController {
  constructor(private readonly service: AdminElectionsService) {}

  list: RequestHandler = async (req, res) => {
    require_role(req, ADMIN_ROLES);
    const response: ApiSuccess<AdminElection[]> = { data: await this.service.list() };
    res.set("Cache-Control", "no-store").json(response);
  };

  get: RequestHandler = async (req, res) => {
    require_role(req, ADMIN_ROLES);
    send(res, await this.service.get(parse_election_id(req.params)));
  };

  create: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const request = admin_election_request_schema.parse(req.body);
    send(res, await this.service.create(user_id, request), 201);
  };

  update: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const election_id = parse_election_id(req.params);
    const request = admin_election_request_schema.parse(req.body);
    send(res, await this.service.update(user_id, election_id, request));
  };

  delete: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    await this.service.delete(user_id, parse_election_id(req.params));
    res.status(204).end();
  };

  add_candidate: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const election_id = parse_election_id(req.params);
    const request = admin_candidate_request_schema.parse(req.body);
    send(res, await this.service.add_candidate(user_id, election_id, request), 201);
  };

  update_candidate: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const election_id = parse_election_id(req.params);
    const candidate_id = parse_candidate_id(req.params);
    const request = admin_candidate_request_schema.parse(req.body);
    send(res, await this.service.update_candidate(user_id, election_id, candidate_id, request));
  };

  delete_candidate: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const election_id = parse_election_id(req.params);
    const candidate_id = parse_candidate_id(req.params);
    await this.service.delete_candidate(user_id, election_id, candidate_id);
    res.status(204).end();
  };

  publish: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    send(res, await this.service.publish(user_id, parse_election_id(req.params)));
  };

  close: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    send(res, await this.service.close(user_id, parse_election_id(req.params)));
  };

  enter_result: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, ADMIN_ROLES);
    const election_id = parse_election_id(req.params);
    const request = admin_result_request_schema.parse(req.body);
    send(res, await this.service.enter_result(user_id, election_id, request));
  };
}
