import type { Kysely } from "kysely";
import type { DB } from "./database_types";

// Who did what, when (editor actions, reader reports, role changes). Written in the same
// transaction as the change it describes.

export interface AuditEntry {
  /** Null = the system or an anonymous reader. */
  actor_user_id: string | null;
  /** e.g. "story.approve", "story.edit", "story.reject", "story.report", "user.make_editor". */
  action: string;
  target_type: string;
  target_id: string | null;
  details?: Record<string, unknown>;
  at: Date;
}

export async function write_audit(db: Kysely<DB>, entry: AuditEntry): Promise<void> {
  await db
    .insertInto("audit_log")
    .values({
      actor_user_id: entry.actor_user_id,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      details: JSON.stringify(entry.details ?? {}),
      created_at: entry.at,
    })
    .execute();
}
