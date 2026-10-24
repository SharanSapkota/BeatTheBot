import type { RequestHandler } from "express";
import {
  update_me_request_schema,
  type ApiSuccess,
  type UserSummary,
} from "@voita_kone/shared_types";
import { require_auth } from "../auth/auth_context";
import type { UsersService } from "./users_service";

// /me is personal: never cached (docs/api.md).
const NO_STORE = "no-store";

export class UsersController {
  constructor(private readonly users_service: UsersService) {}

  get_me: RequestHandler = async (req, res) => {
    const response: ApiSuccess<UserSummary> = {
      data: await this.users_service.get_me(require_auth(req).user_id),
    };
    res.set("Cache-Control", NO_STORE).json(response);
  };

  update_me: RequestHandler = async (req, res) => {
    const { user_id } = require_auth(req);
    const change = update_me_request_schema.parse(req.body);
    const response: ApiSuccess<UserSummary> = {
      data: await this.users_service.update_me(user_id, change),
    };
    res.set("Cache-Control", NO_STORE).json(response);
  };

  delete_me: RequestHandler = async (req, res) => {
    await this.users_service.delete_me(require_auth(req).user_id);
    res.status(204).end();
  };
}
