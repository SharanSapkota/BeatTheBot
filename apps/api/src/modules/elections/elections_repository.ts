import { sql, type Transaction } from "kysely";
import { write_audit, type AuditEntry } from "../../db/audit_log";
import type { DB } from "../../db/database_types";
import type { Database } from "../../db/kysely";

export interface ElectionValues {
  title: string;
  election_type: string;
  area_type: string;
  area_name: string;
  /** YYYY-MM-DD */
  election_date: string;
  poll_opens_at: Date;
  poll_closes_at: Date;
  question_text: string;
  is_demo: boolean;
}

export interface ElectionRow extends ElectionValues {
  id: string;
  status: string;
  candidate_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CandidateValues {
  full_name: string;
  party_or_group: string | null;
  candidate_number: number | null;
  short_bio: string;
  photo_url: string | null;
}

export interface CandidateRow extends CandidateValues {
  id: string;
  election_id: string;
}

export interface PickRow {
  election_id: string;
  candidate_id: string;
  points_awarded: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ResultRow {
  election_id: string;
  winner_candidate_id: string;
  vote_counts: unknown;
  entered_at: Date;
}

export interface ElectionPointsRow {
  user_id: string;
  display_name: string;
  points: number;
}

export interface ResultValues {
  winner_candidate_id: string;
  vote_counts: Record<string, number> | null;
  entered_by: string;
  entered_at: Date;
  /** Points per picked candidate (from packages/scoring), applied to every pick. */
  points_by_candidate: ReadonlyMap<string, number>;
}

/** The audit entry of a change; target_id defaults to the changed row. */
export type ChangeAudit = Omit<AuditEntry, "target_id"> & { target_id?: string | null };

export interface ElectionsRepository {
  list_elections(statuses: readonly string[]): Promise<ElectionRow[]>;
  find_election(election_id: string): Promise<ElectionRow | undefined>;
  /** Fixed admin order: candidate number, then name. Users get their own order on top. */
  list_candidates(election_id: string): Promise<CandidateRow[]>;
  find_pick(user_id: string, election_id: string): Promise<PickRow | undefined>;
  /** Undefined when the user already has a pick (unique user + election). */
  insert_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<PickRow | undefined>;
  update_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<PickRow | undefined>;
  count_picks(election_id: string): Promise<Map<string, number>>;
  find_result(election_id: string): Promise<ResultRow | undefined>;
  /** Points per user over resulted elections (real users only). */
  list_election_points(): Promise<ElectionPointsRow[]>;
  count_resulted_elections(): Promise<number>;

  create_election(values: ElectionValues, created_by: string, audit: ChangeAudit): Promise<string>;
  update_election(election_id: string, values: ElectionValues, audit: ChangeAudit): Promise<void>;
  delete_election(election_id: string, audit: ChangeAudit): Promise<void>;
  set_status(
    election_id: string,
    status: string,
    poll_closes_at: Date | undefined,
    audit: ChangeAudit,
  ): Promise<void>;
  create_candidate(
    election_id: string,
    values: CandidateValues,
    audit: ChangeAudit,
  ): Promise<string>;
  update_candidate(
    candidate_id: string,
    values: CandidateValues,
    audit: ChangeAudit,
  ): Promise<void>;
  delete_candidate(candidate_id: string, audit: ChangeAudit): Promise<void>;
  /** Saves (or replaces) the result, sets status resulted and scores every pick, in one transaction. */
  save_result(election_id: string, result: ResultValues, audit: ChangeAudit): Promise<void>;
}

const election_date_text = sql<string>`to_char(elections.election_date, 'YYYY-MM-DD')`;

const CANDIDATE_COLUMNS = [
  "id",
  "election_id",
  "full_name",
  "party_or_group",
  "candidate_number",
  "short_bio",
  "photo_url",
] as const;

const PICK_COLUMNS = [
  "election_id",
  "candidate_id",
  "points_awarded",
  "created_at",
  "updated_at",
] as const;

async function audit_change(
  trx: Transaction<DB>,
  audit: ChangeAudit,
  target_id: string,
): Promise<void> {
  await write_audit(trx, { ...audit, target_id: audit.target_id ?? target_id });
}

export class KyselyElectionsRepository implements ElectionsRepository {
  constructor(private readonly db: Database) {}

  private select_elections() {
    return this.db.selectFrom("elections").select((eb) => [
      "elections.id",
      "elections.title",
      "elections.election_type",
      "elections.area_type",
      "elections.area_name",
      election_date_text.as("election_date"),
      "elections.poll_opens_at",
      "elections.poll_closes_at",
      "elections.status",
      "elections.question_text",
      "elections.is_demo",
      "elections.created_at",
      "elections.updated_at",
      eb
        .selectFrom("election_candidates")
        .select(sql<number>`count(*)::int`.as("count"))
        .whereRef("election_candidates.election_id", "=", "elections.id")
        .as("candidate_count"),
    ]);
  }

  private static to_row(
    row: {
      candidate_count: number | null;
    } & Omit<ElectionRow, "candidate_count">,
  ): ElectionRow {
    return { ...row, candidate_count: row.candidate_count ?? 0 };
  }

  async list_elections(statuses: readonly string[]): Promise<ElectionRow[]> {
    if (statuses.length === 0) {
      return [];
    }
    const rows = await this.select_elections()
      .where("elections.status", "in", [...statuses])
      .orderBy("elections.election_date", "desc")
      .orderBy("elections.title")
      .execute();
    return rows.map(KyselyElectionsRepository.to_row);
  }

  async find_election(election_id: string): Promise<ElectionRow | undefined> {
    const row = await this.select_elections()
      .where("elections.id", "=", election_id)
      .executeTakeFirst();
    return row ? KyselyElectionsRepository.to_row(row) : undefined;
  }

  list_candidates(election_id: string): Promise<CandidateRow[]> {
    return this.db
      .selectFrom("election_candidates")
      .select(CANDIDATE_COLUMNS)
      .where("election_id", "=", election_id)
      .orderBy("candidate_number", (order) => order.asc().nullsLast())
      .orderBy("full_name")
      .orderBy("id")
      .execute();
  }

  find_pick(user_id: string, election_id: string): Promise<PickRow | undefined> {
    return this.db
      .selectFrom("election_picks")
      .select(PICK_COLUMNS)
      .where("user_id", "=", user_id)
      .where("election_id", "=", election_id)
      .executeTakeFirst();
  }

  insert_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<PickRow | undefined> {
    return this.db
      .insertInto("election_picks")
      .values({ user_id, election_id, candidate_id })
      .onConflict((conflict) =>
        conflict.constraint("election_picks_user_id_election_id_unique").doNothing(),
      )
      .returning(PICK_COLUMNS)
      .executeTakeFirst();
  }

  update_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<PickRow | undefined> {
    return this.db
      .updateTable("election_picks")
      .set({ candidate_id })
      .where("user_id", "=", user_id)
      .where("election_id", "=", election_id)
      .returning(PICK_COLUMNS)
      .executeTakeFirst();
  }

  async count_picks(election_id: string): Promise<Map<string, number>> {
    const rows = await this.db
      .selectFrom("election_picks")
      .select(["candidate_id", sql<number>`count(*)::int`.as("picks")])
      .where("election_id", "=", election_id)
      .groupBy("candidate_id")
      .execute();
    return new Map(rows.map((row) => [row.candidate_id, row.picks]));
  }

  find_result(election_id: string): Promise<ResultRow | undefined> {
    return this.db
      .selectFrom("election_results")
      .select(["election_id", "winner_candidate_id", "vote_counts", "entered_at"])
      .where("election_id", "=", election_id)
      .executeTakeFirst();
  }

  list_election_points(): Promise<ElectionPointsRow[]> {
    return this.db
      .selectFrom("election_picks")
      .innerJoin("elections", "elections.id", "election_picks.election_id")
      .innerJoin("users", "users.id", "election_picks.user_id")
      .select([
        "users.id as user_id",
        "users.display_name",
        sql<number>`coalesce(sum(election_picks.points_awarded), 0)::int`.as("points"),
      ])
      .where("elections.status", "=", "resulted")
      .where("users.deleted_at", "is", null)
      .groupBy(["users.id", "users.display_name"])
      .execute();
  }

  async count_resulted_elections(): Promise<number> {
    const row = await this.db
      .selectFrom("elections")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("status", "=", "resulted")
      .executeTakeFirstOrThrow();
    return row.count;
  }

  create_election(values: ElectionValues, created_by: string, audit: ChangeAudit): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto("elections")
        .values({ ...values, created_by, status: "draft" })
        .returning("id")
        .executeTakeFirstOrThrow();
      await audit_change(trx, audit, id);
      return id;
    });
  }

  async update_election(
    election_id: string,
    values: ElectionValues,
    audit: ChangeAudit,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable("elections").set(values).where("id", "=", election_id).execute();
      await audit_change(trx, audit, election_id);
    });
  }

  async delete_election(election_id: string, audit: ChangeAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("elections").where("id", "=", election_id).execute();
      await audit_change(trx, audit, election_id);
    });
  }

  async set_status(
    election_id: string,
    status: string,
    poll_closes_at: Date | undefined,
    audit: ChangeAudit,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("elections")
        .set(poll_closes_at ? { status, poll_closes_at } : { status })
        .where("id", "=", election_id)
        .execute();
      await audit_change(trx, audit, election_id);
    });
  }

  create_candidate(
    election_id: string,
    values: CandidateValues,
    audit: ChangeAudit,
  ): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto("election_candidates")
        .values({ ...values, election_id })
        .returning("id")
        .executeTakeFirstOrThrow();
      await audit_change(trx, audit, id);
      return id;
    });
  }

  async update_candidate(
    candidate_id: string,
    values: CandidateValues,
    audit: ChangeAudit,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("election_candidates")
        .set(values)
        .where("id", "=", candidate_id)
        .execute();
      await audit_change(trx, audit, candidate_id);
    });
  }

  async delete_candidate(candidate_id: string, audit: ChangeAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("election_candidates").where("id", "=", candidate_id).execute();
      await audit_change(trx, audit, candidate_id);
    });
  }

  async save_result(election_id: string, result: ResultValues, audit: ChangeAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const row = {
        election_id,
        winner_candidate_id: result.winner_candidate_id,
        vote_counts: result.vote_counts === null ? null : JSON.stringify(result.vote_counts),
        entered_by: result.entered_by,
        entered_at: result.entered_at,
      };
      await trx
        .insertInto("election_results")
        .values(row)
        .onConflict((conflict) =>
          conflict.column("election_id").doUpdateSet({
            winner_candidate_id: row.winner_candidate_id,
            vote_counts: row.vote_counts,
            entered_by: row.entered_by,
            entered_at: row.entered_at,
          }),
        )
        .execute();
      await trx
        .updateTable("elections")
        .set({ status: "resulted" })
        .where("id", "=", election_id)
        .execute();
      for (const [candidate_id, points] of result.points_by_candidate) {
        await trx
          .updateTable("election_picks")
          .set({ points_awarded: points, scored_at: result.entered_at })
          .where("election_id", "=", election_id)
          .where("candidate_id", "=", candidate_id)
          .execute();
      }
      await audit_change(trx, audit, election_id);
    });
  }
}
