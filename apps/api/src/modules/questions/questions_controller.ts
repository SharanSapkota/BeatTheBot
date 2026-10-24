import type { RequestHandler } from "express";
import {
  answer_request_schema,
  question_phase_schema,
  replay_moment_schema,
  type AnswerResult,
  type ApiSuccess,
  type Question,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { find_auth, require_auth } from "../auth/auth_context";
import { game_not_found } from "../games/games_service";
import { question_not_found, type QuestionsService } from "./questions_service";

const game_params_schema = z.object({ game_id: z.string() });
const question_params_schema = z.object({ question_id: z.string() });
const query_schema = z.object({ phase: question_phase_schema });
const demo_query_schema = query_schema.extend({ moment: replay_moment_schema });

/** A malformed id can't match any game. */
function parse_game_id(params: unknown): string {
  const { game_id } = game_params_schema.parse(params);
  if (!z.uuid().safeParse(game_id).success) {
    throw game_not_found(game_id);
  }
  return game_id;
}

function parse_question_id(params: unknown): string {
  const { question_id } = question_params_schema.parse(params);
  if (!z.uuid().safeParse(question_id).success) {
    throw question_not_found(question_id);
  }
  return question_id;
}

export class QuestionsController {
  constructor(private readonly questions_service: QuestionsService) {}

  list: RequestHandler = async (req, res) => {
    const game_id = parse_game_id(req.params);
    const { phase } = query_schema.parse(req.query);
    const user_id = find_auth(req)?.user_id ?? null;
    const response: ApiSuccess<Question[]> = {
      data: await this.questions_service.list(game_id, phase, user_id),
    };
    // Live, and with the user's own answers.
    res.set("Cache-Control", "no-store").json(response);
  };

  answer: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const question_id = parse_question_id(req.params);
    const { answer } = answer_request_schema.parse(req.body);
    const response: ApiSuccess<AnswerResult> = {
      data: await this.questions_service.answer(user_id, question_id, answer),
    };
    res.status(201).json(response);
  };

  list_demo: RequestHandler = async (req, res) => {
    const game_id = parse_game_id(req.params);
    const { phase, moment } = demo_query_schema.parse(req.query);
    const response: ApiSuccess<Question[]> = {
      data: await this.questions_service.list_demo(game_id, phase, moment),
    };
    res.set("Cache-Control", "no-store").json(response);
  };
}
