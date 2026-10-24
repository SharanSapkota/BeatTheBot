import { parseArgs } from "node:util";
import { env } from "../../config/env";
import { write_audit } from "../../db/audit_log";
import { create_database } from "../../db/kysely";

export interface RoleScript {
  role: "editor" | "admin";
  /** The audit_log action, e.g. "user.make_editor". */
  action: string;
  /** The package script, e.g. "make:editor". */
  script_name: string;
}

/** Usage: pnpm --filter @voita_kone/api <script_name> -- --user_id <id>. Logged in audit_log. */
export async function set_user_role({ role, action, script_name }: RoleScript): Promise<void> {
  const usage = `Usage: pnpm --filter @voita_kone/api ${script_name} -- --user_id <id>`;
  const { values } = parseArgs({
    // pnpm may pass the "--" separator through.
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: { user_id: { type: "string" } },
    allowPositionals: true,
  });
  const user_id = values.user_id;
  if (!user_id) {
    throw new Error(usage);
  }
  const db = create_database(env.DATABASE_URL);
  try {
    await db.transaction().execute(async (trx) => {
      const user = await trx
        .updateTable("users")
        .set({ role })
        .where("id", "=", user_id)
        .where("deleted_at", "is", null)
        .returning(["id", "display_name"])
        .executeTakeFirst();
      if (!user) {
        throw new Error(`No user ${user_id}`);
      }
      await write_audit(trx, {
        actor_user_id: null,
        action,
        target_type: "user",
        target_id: user.id,
        details: { by: `${script_name} script` },
        at: new Date(),
      });
      console.log(`${user.display_name} is now ${role === "admin" ? "an admin" : "an editor"}.`);
    });
  } finally {
    await db.destroy();
  }
}

export function run_role_script(script: RoleScript): void {
  set_user_role(script).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
