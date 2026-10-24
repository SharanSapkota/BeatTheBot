import { sql } from "kysely";
import type { Database } from "../../db/kysely";
import type { UserRow } from "../auth/auth_repository";

export interface UsersRepository {
  find_user(user_id: string): Promise<UserRow | undefined>;
  /** Sum of the user's awarded points: before-game picks plus live picks, quiz and vote. */
  sum_points(user_id: string): Promise<number>;
  update_display_name(user_id: string, display_name: string): Promise<UserRow | undefined>;
  /** GDPR delete: the user and, by cascade, identities, sessions, picks and answers. */
  delete_user(user_id: string): Promise<void>;
}

export class KyselyUsersRepository implements UsersRepository {
  constructor(private readonly db: Database) {}

  find_user(user_id: string): Promise<UserRow | undefined> {
    return this.db
      .selectFrom("users")
      .select(["id", "display_name", "role"])
      .where("id", "=", user_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
  }

  async sum_points(user_id: string): Promise<number> {
    const [picks, answers] = await Promise.all([
      this.db
        .selectFrom("user_predictions")
        .select(sql<number>`coalesce(sum(points_awarded), 0)::int`.as("total"))
        .where("user_id", "=", user_id)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("user_answers")
        .select(sql<number>`coalesce(sum(points_awarded), 0)::int`.as("total"))
        .where("user_id", "=", user_id)
        .executeTakeFirstOrThrow(),
    ]);
    return picks.total + answers.total;
  }

  update_display_name(user_id: string, display_name: string): Promise<UserRow | undefined> {
    return this.db
      .updateTable("users")
      .set({ display_name })
      .where("id", "=", user_id)
      .where("deleted_at", "is", null)
      .returning(["id", "display_name", "role"])
      .executeTakeFirst();
  }

  async delete_user(user_id: string): Promise<void> {
    await this.db.deleteFrom("users").where("id", "=", user_id).execute();
  }
}
