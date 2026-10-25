import { sql } from "kysely";
import type { Database } from "../../db/kysely";

export interface HealthRepository {
  /** Resolves when the database answers a trivial query. */
  ping(): Promise<void>;
}

export class KyselyHealthRepository implements HealthRepository {
  constructor(private readonly db: Database) {}

  async ping(): Promise<void> {
    await sql`select 1`.execute(this.db);
  }
}
