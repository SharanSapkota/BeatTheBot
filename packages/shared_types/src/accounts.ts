import { z } from "zod";
import { api_success_schema } from "./api_response";

// Accounts (step 4). MVP: device sign-in; Kaleva identity linking comes later (architecture.md).

export const DISPLAY_NAME_MAX_LENGTH = 30;

/** 1–30 characters after trimming. */
export const display_name_schema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);

export const user_role_schema = z.enum(["player", "editor", "admin"]);

/** POST /auth/device */
export const device_sign_in_request_schema = z.object({ display_name: display_name_schema });

/** PATCH /me */
export const update_me_request_schema = z.object({ display_name: display_name_schema.optional() });

export const user_schema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  role: user_role_schema,
});

export const auth_result_schema = z.object({
  /** Send as `Authorization: Bearer <token>`. Valid 90 days. */
  token: z.string(),
  user: user_schema,
});

/** GET /me: the signed-in user and their total points. */
export const user_summary_schema = user_schema.extend({
  total_points: z.number().int(),
});

export const auth_result_response_schema = api_success_schema(auth_result_schema);
export const user_summary_response_schema = api_success_schema(user_summary_schema);

export type UserRole = z.infer<typeof user_role_schema>;
export type DeviceSignInRequest = z.infer<typeof device_sign_in_request_schema>;
export type UpdateMeRequest = z.infer<typeof update_me_request_schema>;
export type User = z.infer<typeof user_schema>;
export type AuthResult = z.infer<typeof auth_result_schema>;
export type UserSummary = z.infer<typeof user_summary_schema>;
