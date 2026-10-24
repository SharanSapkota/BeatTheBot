import type { Database } from "../../db/kysely";

export interface UserRow {
  id: string;
  display_name: string;
  role: string;
}

export interface SessionRow {
  session_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  user: UserRow;
}

export interface NewDeviceUser {
  display_name: string;
  device_subject: string;
  token_hash: string;
  expires_at: Date;
  user_agent: string | null;
}

export interface AuthRepository {
  /** Creates the user, its device identity and a session in one transaction. */
  create_device_user(input: NewDeviceUser): Promise<UserRow>;
  /** The session with this token hash and its (not deleted) user. */
  find_session(token_hash: string): Promise<SessionRow | undefined>;
  touch_session(session_id: string, used_at: Date): Promise<void>;
  revoke_session(session_id: string, revoked_at: Date): Promise<void>;
}

export class KyselyAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  create_device_user(input: NewDeviceUser): Promise<UserRow> {
    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .insertInto("users")
        .values({ display_name: input.display_name })
        .returning(["id", "display_name", "role"])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto("auth_identities")
        .values({
          user_id: user.id,
          provider: "device",
          provider_subject: input.device_subject,
          last_used_at: new Date(),
        })
        .execute();
      await trx
        .insertInto("sessions")
        .values({
          user_id: user.id,
          token_hash: input.token_hash,
          expires_at: input.expires_at,
          user_agent: input.user_agent,
        })
        .execute();
      return user;
    });
  }

  async find_session(token_hash: string): Promise<SessionRow | undefined> {
    const row = await this.db
      .selectFrom("sessions")
      .innerJoin("users", "users.id", "sessions.user_id")
      .select([
        "sessions.id as session_id",
        "sessions.expires_at",
        "sessions.revoked_at",
        "users.id as user_id",
        "users.display_name",
        "users.role",
      ])
      .where("sessions.token_hash", "=", token_hash)
      .where("users.deleted_at", "is", null)
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return {
      session_id: row.session_id,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      user: { id: row.user_id, display_name: row.display_name, role: row.role },
    };
  }

  async touch_session(session_id: string, used_at: Date): Promise<void> {
    await this.db
      .updateTable("sessions")
      .set({ last_used_at: used_at })
      .where("id", "=", session_id)
      .execute();
  }

  async revoke_session(session_id: string, revoked_at: Date): Promise<void> {
    await this.db
      .updateTable("sessions")
      .set({ revoked_at })
      .where("id", "=", session_id)
      .execute();
  }
}
