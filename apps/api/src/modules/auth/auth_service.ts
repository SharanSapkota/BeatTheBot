import { user_role_schema, type AuthResult, type User } from "@voita_kone/shared_types";
import type { Clock } from "../../common/clock";
import { unauthorized, type AuthContext } from "./auth_context";
import type { AuthRepository, UserRow } from "./auth_repository";
import {
  generate_device_subject,
  generate_session_token,
  hash_session_token,
} from "./session_token";

export const SESSION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
/** last_used_at is written at most this often per session, not on every request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export function to_user(row: UserRow): User {
  return { id: row.id, display_name: row.display_name, role: user_role_schema.parse(row.role) };
}

export class AuthService {
  private readonly last_touched = new Map<string, number>();

  constructor(
    private readonly repository: AuthRepository,
    private readonly clock: Clock,
  ) {}

  /** MVP sign-in: a new user with a device identity and a 90-day session. */
  async sign_in_device(display_name: string, user_agent: string | null): Promise<AuthResult> {
    const token = generate_session_token();
    const user = await this.repository.create_device_user({
      display_name,
      device_subject: generate_device_subject(),
      token_hash: hash_session_token(token),
      expires_at: new Date(this.clock().getTime() + SESSION_DAYS * DAY_MS),
      user_agent,
    });
    return { token, user: to_user(user) };
  }

  /** The user behind a Bearer token; 401 UNAUTHORIZED for an unknown, revoked or expired one. */
  async authenticate(token: string): Promise<AuthContext> {
    const session = await this.repository.find_session(hash_session_token(token));
    const now = this.clock();
    if (!session || session.revoked_at !== null || session.expires_at <= now) {
      throw unauthorized();
    }
    await this.touch(session.session_id, now);
    const user = to_user(session.user);
    return {
      user_id: user.id,
      session_id: session.session_id,
      display_name: user.display_name,
      role: user.role,
    };
  }

  async logout(session_id: string): Promise<void> {
    await this.repository.revoke_session(session_id, this.clock());
  }

  private async touch(session_id: string, now: Date): Promise<void> {
    const last = this.last_touched.get(session_id);
    if (last !== undefined && now.getTime() - last < TOUCH_INTERVAL_MS) {
      return;
    }
    this.last_touched.set(session_id, now.getTime());
    await this.repository.touch_session(session_id, now);
  }
}
