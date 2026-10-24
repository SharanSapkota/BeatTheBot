import type { RequestHandler } from "express";
import {
  device_sign_in_request_schema,
  type ApiSuccess,
  type AuthResult,
} from "@voita_kone/shared_types";
import { require_auth } from "./auth_context";
import type { AuthService } from "./auth_service";

export class AuthController {
  constructor(private readonly auth_service: AuthService) {}

  sign_in_device: RequestHandler = async (req, res) => {
    const { display_name } = device_sign_in_request_schema.parse(req.body);
    const response: ApiSuccess<AuthResult> = {
      data: await this.auth_service.sign_in_device(display_name, req.get("user-agent") ?? null),
    };
    res.status(201).json(response);
  };

  logout: RequestHandler = async (req, res) => {
    await this.auth_service.logout(require_auth(req).session_id);
    res.status(204).end();
  };
}
