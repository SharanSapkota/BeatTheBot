import type { RequestHandler } from "express";
import {
  election_list_query_schema,
  election_pick_request_schema,
  type ApiSuccess,
  type ElectionDetail,
  type ElectionLeaderboard,
  type ElectionList,
  type ElectionPick,
  type ElectionResults,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { find_auth, require_auth } from "../auth/auth_context";
import { election_not_found, type ElectionsService } from "./elections_service";

const params_schema = z.object({ election_id: z.string() });

/** A malformed id can't match any election. */
export function parse_election_id(params: unknown): string {
  const { election_id } = params_schema.parse(params);
  if (!z.uuid().safeParse(election_id).success) {
    throw election_not_found(election_id);
  }
  return election_id;
}

/** Users' elections. Everything is no-store: the order and pick depend on the user. */
export class ElectionsController {
  constructor(private readonly elections_service: ElectionsService) {}

  list: RequestHandler = async (req, res) => {
    const query = election_list_query_schema.parse(req.query);
    const response: ApiSuccess<ElectionList> = { data: await this.elections_service.list(query) };
    res.set("Cache-Control", "no-store").json(response);
  };

  get: RequestHandler = async (req, res) => {
    const election_id = parse_election_id(req.params);
    const response: ApiSuccess<ElectionDetail> = {
      data: await this.elections_service.get(election_id, find_auth(req)?.user_id ?? null),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  create_pick: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const election_id = parse_election_id(req.params);
    const { candidate_id } = election_pick_request_schema.parse(req.body);
    const response: ApiSuccess<ElectionPick> = {
      data: await this.elections_service.create_pick(user_id, election_id, candidate_id),
    };
    res.status(201).json(response);
  };

  update_pick: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const election_id = parse_election_id(req.params);
    const { candidate_id } = election_pick_request_schema.parse(req.body);
    const response: ApiSuccess<ElectionPick> = {
      data: await this.elections_service.update_pick(user_id, election_id, candidate_id),
    };
    res.json(response);
  };

  results: RequestHandler = async (req, res) => {
    const election_id = parse_election_id(req.params);
    const response: ApiSuccess<ElectionResults> = {
      data: await this.elections_service.results(election_id, find_auth(req)?.user_id ?? null),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  leaderboard: RequestHandler = async (req, res) => {
    const user_id = find_auth(req)?.user_id ?? null;
    const response: ApiSuccess<ElectionLeaderboard> = {
      data: await this.elections_service.leaderboard(user_id),
    };
    res
      .set("Cache-Control", user_id === null ? "public, max-age=60" : "private, no-store")
      .json(response);
  };
}
