import type { RequestHandler } from "express";
import {
  editor_edit_request_schema,
  editor_reject_request_schema,
  type ApiSuccess,
  type EditorActionResult,
  type EditorStory,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { require_role } from "../auth/auth_context";
import type { EditorService } from "./editor_service";
import { story_not_found } from "./stories_service";

const EDITOR_ROLES = ["editor", "admin"] as const;
const params_schema = z.object({ story_id: z.string() });

function parse_story_id(params: unknown): string {
  const { story_id } = params_schema.parse(params);
  if (!z.uuid().safeParse(story_id).success) {
    throw story_not_found(story_id);
  }
  return story_id;
}

/** The story queue and the editor's decisions. 401 anonymous, 403 for users. */
export class EditorController {
  constructor(private readonly editor_service: EditorService) {}

  list: RequestHandler = async (req, res) => {
    require_role(req, EDITOR_ROLES);
    const response: ApiSuccess<EditorStory[]> = { data: await this.editor_service.list_queue() };
    res.set("Cache-Control", "no-store").json(response);
  };

  approve: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, EDITOR_ROLES);
    const response: ApiSuccess<EditorActionResult> = {
      data: await this.editor_service.approve(user_id, parse_story_id(req.params)),
    };
    res.json(response);
  };

  edit: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, EDITOR_ROLES);
    const story_id = parse_story_id(req.params);
    const { body, note } = editor_edit_request_schema.parse(req.body);
    const response: ApiSuccess<EditorActionResult> = {
      data: await this.editor_service.edit(user_id, story_id, body, note),
    };
    res.json(response);
  };

  reject: RequestHandler = async (req, res) => {
    const { user_id } = require_role(req, EDITOR_ROLES);
    const story_id = parse_story_id(req.params);
    const { note } = editor_reject_request_schema.parse(req.body ?? {});
    const response: ApiSuccess<EditorActionResult> = {
      data: await this.editor_service.reject(user_id, story_id, note),
    };
    res.json(response);
  };
}
