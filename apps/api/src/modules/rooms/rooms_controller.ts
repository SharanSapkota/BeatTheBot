import type { RequestHandler } from "express";
import {
  create_room_request_schema,
  join_room_request_schema,
  room_answer_request_schema,
  room_leaderboard_query_schema,
  room_questions_query_schema,
  room_reaction_request_schema,
  update_room_request_schema,
  type ApiSuccess,
  type RoomAnswer,
  type RoomCurrent,
  type RoomDetail,
  type RoomLeaderboard,
  type RoomReactions,
  type RoomRevealedQuestion,
  type RoomSummary,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { require_auth } from "../auth/auth_context";
import {
  member_not_found,
  question_not_found,
  room_not_found,
  type RoomsService,
} from "./rooms_service";

/** A malformed id can't match any row. */
function parse_id(params: unknown, name: string, not_found: () => Error): string {
  const value = z.record(z.string(), z.string()).parse(params)[name] ?? "";
  if (!z.uuid().safeParse(value).success) {
    throw not_found();
  }
  return value;
}

const room_id_of = (params: unknown) => parse_id(params, "room_id", room_not_found);
const question_id_of = (params: unknown) => parse_id(params, "question_id", question_not_found);

/** Rooms are private and per user: every route needs a session and answers no-store. */
export class RoomsController {
  constructor(private readonly rooms_service: RoomsService) {}

  create: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const body = create_room_request_schema.parse(req.body);
    const response: ApiSuccess<RoomDetail> = {
      data: await this.rooms_service.create(user_id, body),
    };
    res.status(201).set("Cache-Control", "no-store").json(response);
  };

  list_mine: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const response: ApiSuccess<RoomSummary[]> = {
      data: await this.rooms_service.list_mine(user_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  join: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const { key } = join_room_request_schema.parse(req.body);
    const response: ApiSuccess<RoomDetail> = { data: await this.rooms_service.join(user_id, key) };
    res.set("Cache-Control", "no-store").json(response);
  };

  get: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const response: ApiSuccess<RoomDetail> = {
      data: await this.rooms_service.get(room_id_of(req.params), user_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  update: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const room_id = room_id_of(req.params);
    const body = update_room_request_schema.parse(req.body);
    const response: ApiSuccess<RoomDetail> = {
      data: await this.rooms_service.update(room_id, user_id, body),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  regenerate_key: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const response: ApiSuccess<RoomDetail> = {
      data: await this.rooms_service.regenerate_key(room_id_of(req.params), user_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  close: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const response: ApiSuccess<RoomDetail> = {
      data: await this.rooms_service.close(room_id_of(req.params), user_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  remove_member: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const room_id = room_id_of(req.params);
    const member_id = parse_id(req.params, "user_id", member_not_found);
    await this.rooms_service.remove_member(room_id, user_id, member_id);
    res.status(204).end();
  };

  current_question: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const response: ApiSuccess<RoomCurrent> = {
      data: await this.rooms_service.current_question(room_id_of(req.params), user_id),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  past_questions: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const room_id = room_id_of(req.params);
    const { limit } = room_questions_query_schema.parse(req.query);
    const response: ApiSuccess<RoomRevealedQuestion[]> = {
      data: await this.rooms_service.past_questions(room_id, user_id, limit),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  leaderboard: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const room_id = room_id_of(req.params);
    const { period } = room_leaderboard_query_schema.parse(req.query);
    const response: ApiSuccess<RoomLeaderboard> = {
      data: await this.rooms_service.leaderboard(room_id, user_id, period),
    };
    res.set("Cache-Control", "no-store").json(response);
  };

  answer: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const question_id = question_id_of(req.params);
    const { option } = room_answer_request_schema.parse(req.body);
    const response: ApiSuccess<RoomAnswer> = {
      data: await this.rooms_service.answer(question_id, user_id, option),
    };
    res.status(201).json(response);
  };

  react: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const question_id = question_id_of(req.params);
    const { emoji } = room_reaction_request_schema.parse(req.body);
    const response: ApiSuccess<RoomReactions> = {
      data: await this.rooms_service.toggle_reaction(question_id, user_id, emoji),
    };
    res.json(response);
  };
}
