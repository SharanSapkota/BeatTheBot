import type { RoomOption } from "@voita_kone/shared_types";
import { sql } from "kysely";
import type { Database } from "../../db/kysely";
import type { RoomQuestionDraft } from "./question_picker";

export interface RoomRow {
  id: string;
  name: string;
  topic: string;
  join_key: string;
  owner_id: string;
  question_interval_seconds: number;
  max_members: number;
  status: string;
  is_demo: boolean;
  schedule_started_at: Date;
  slot_base: number;
  created_at: Date;
}

export interface MyRoomRow extends RoomRow {
  my_role: string;
  member_count: number;
}

export interface NewRoom {
  name: string;
  topic: string;
  join_key: string;
  owner_id: string;
  question_interval_seconds: number;
  /** created_at, schedule start and the owner's joined_at. */
  now: Date;
}

export interface RoomChanges {
  name?: string;
  question_interval_seconds?: number;
  schedule_started_at?: Date;
  slot_base?: number;
}

export interface MemberRow {
  user_id: string;
  display_name: string;
  role: string;
  joined_at: Date;
}

export interface QuestionRow {
  id: string;
  room_id: string;
  slot_index: number;
  question_type: string;
  prompt: string;
  options: RoomOption[];
  correct_option: string | null;
  points: number;
  opens_at: Date;
  locks_at: Date;
}

export interface AnswerRow {
  question_id: string;
  user_id: string;
  display_name: string;
  option: string;
  points_awarded: number;
  created_at: Date;
}

export interface ReactionRow {
  question_id: string;
  user_id: string;
  emoji: string;
}

/** Points per member and room over revealed questions. */
export interface RoomPointsRow {
  room_id: string;
  user_id: string;
  points: number;
}

/** One member's answers in a room over revealed questions (optionally since a time). */
export interface AnswerStatsRow {
  user_id: string;
  points: number;
  answers: number;
  trivia_answers: number;
  trivia_correct: number;
}

export type AddMemberResult = "added" | "already_member" | "full";

export interface RoomsRepository {
  /** Inserts the room and its owner as a member. Undefined when the join key is taken. */
  insert_room(room: NewRoom): Promise<RoomRow | undefined>;
  count_active_owned_rooms(user_id: string): Promise<number>;
  find_room(room_id: string): Promise<RoomRow | undefined>;
  find_room_by_key(join_key: string): Promise<RoomRow | undefined>;
  update_room(room_id: string, changes: RoomChanges): Promise<void>;
  /** Undefined when another room has this key. */
  set_join_key(room_id: string, join_key: string): Promise<string | undefined>;
  set_status(room_id: string, status: string): Promise<void>;
  list_my_rooms(user_id: string): Promise<MyRoomRow[]>;

  list_members(room_id: string): Promise<MemberRow[]>;
  /** The member's role, or undefined for a non-member. */
  find_member_role(room_id: string, user_id: string): Promise<string | undefined>;
  count_members(room_id: string): Promise<number>;
  /** Adds a member unless the room is full (locks the room row, so the limit holds). */
  add_member(room_id: string, user_id: string, now: Date): Promise<AddMemberResult>;
  remove_member(room_id: string, user_id: string): Promise<boolean>;

  find_question(question_id: string): Promise<QuestionRow | undefined>;
  find_question_by_slot(room_id: string, slot_index: number): Promise<QuestionRow | undefined>;
  /** Does nothing when the slot already has a question (another request was first). */
  insert_question(
    room_id: string,
    slot_index: number,
    question: RoomQuestionDraft & { source: string },
    window: { opens_at: Date; locks_at: Date },
  ): Promise<void>;
  list_used_prompts(room_id: string): Promise<string[]>;
  /** Locked questions, newest first. */
  list_revealed_questions(room_id: string, now: Date, limit: number): Promise<QuestionRow[]>;

  list_answers(question_ids: readonly string[]): Promise<AnswerRow[]>;
  count_answers(question_id: string): Promise<number>;
  find_answer(question_id: string, user_id: string): Promise<AnswerRow | undefined>;
  /** Undefined when the user already answered (unique question + user). */
  insert_answer(
    question_id: string,
    user_id: string,
    option: string,
    points_awarded: number,
    now: Date,
  ): Promise<{ created_at: Date } | undefined>;

  list_reactions(question_ids: readonly string[]): Promise<ReactionRow[]>;
  /** Adds the reaction, or removes it when it is already there. */
  toggle_reaction(question_id: string, user_id: string, emoji: string): Promise<void>;

  list_room_points(room_ids: readonly string[], now: Date): Promise<RoomPointsRow[]>;
  list_answer_stats(room_id: string, now: Date, since: Date | null): Promise<AnswerStatsRow[]>;
}

const ROOM_COLUMNS = [
  "rooms.id",
  "rooms.name",
  "rooms.topic",
  "rooms.join_key",
  "rooms.owner_id",
  "rooms.question_interval_seconds",
  "rooms.max_members",
  "rooms.status",
  "rooms.is_demo",
  "rooms.schedule_started_at",
  "rooms.slot_base",
  "rooms.created_at",
] as const;

const QUESTION_COLUMNS = [
  "id",
  "room_id",
  "slot_index",
  "question_type",
  "prompt",
  "options",
  "correct_option",
  "points",
  "opens_at",
  "locks_at",
] as const;

function to_question(row: Omit<QuestionRow, "options"> & { options: unknown }): QuestionRow {
  return { ...row, options: row.options as RoomOption[] };
}

export class KyselyRoomsRepository implements RoomsRepository {
  constructor(private readonly db: Database) {}

  insert_room(room: NewRoom): Promise<RoomRow | undefined> {
    return this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto("rooms")
        .values({
          name: room.name,
          topic: room.topic,
          join_key: room.join_key,
          owner_id: room.owner_id,
          question_interval_seconds: room.question_interval_seconds,
          schedule_started_at: room.now,
          created_at: room.now,
        })
        .onConflict((conflict) => conflict.column("join_key").doNothing())
        .returning(ROOM_COLUMNS)
        .executeTakeFirst();
      if (!inserted) {
        return undefined;
      }
      await trx
        .insertInto("room_members")
        .values({
          room_id: inserted.id,
          user_id: room.owner_id,
          role: "owner",
          joined_at: room.now,
        })
        .execute();
      return inserted;
    });
  }

  async count_active_owned_rooms(user_id: string): Promise<number> {
    const row = await this.db
      .selectFrom("rooms")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("owner_id", "=", user_id)
      .where("status", "=", "active")
      .executeTakeFirstOrThrow();
    return row.count;
  }

  find_room(room_id: string): Promise<RoomRow | undefined> {
    return this.db
      .selectFrom("rooms")
      .select(ROOM_COLUMNS)
      .where("id", "=", room_id)
      .executeTakeFirst();
  }

  find_room_by_key(join_key: string): Promise<RoomRow | undefined> {
    return this.db
      .selectFrom("rooms")
      .select(ROOM_COLUMNS)
      .where("join_key", "=", join_key)
      .executeTakeFirst();
  }

  async update_room(room_id: string, changes: RoomChanges): Promise<void> {
    await this.db.updateTable("rooms").set(changes).where("id", "=", room_id).execute();
  }

  async set_join_key(room_id: string, join_key: string): Promise<string | undefined> {
    const row = await this.db
      .updateTable("rooms")
      .set({ join_key })
      .where("id", "=", room_id)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("rooms as other")
              .select("other.id")
              .where("other.join_key", "=", join_key),
          ),
        ),
      )
      .returning("join_key")
      .executeTakeFirst();
    return row?.join_key;
  }

  async set_status(room_id: string, status: string): Promise<void> {
    await this.db.updateTable("rooms").set({ status }).where("id", "=", room_id).execute();
  }

  list_my_rooms(user_id: string): Promise<MyRoomRow[]> {
    return (
      this.db
        .selectFrom("room_members as mine")
        .innerJoin("rooms", "rooms.id", "mine.room_id")
        .select((eb) => [
          ...ROOM_COLUMNS,
          "mine.role as my_role",
          eb
            .selectFrom("room_members")
            .select(sql<number>`count(*)::int`.as("count"))
            .whereRef("room_members.room_id", "=", "rooms.id")
            .as("member_count"),
        ])
        .where("mine.user_id", "=", user_id)
        // Active rooms first, then the newest.
        .orderBy(sql`rooms.status = 'active'`, "desc")
        .orderBy("rooms.created_at", "desc")
        .execute()
        .then((rows) => rows.map((row) => ({ ...row, member_count: row.member_count ?? 0 })))
    );
  }

  list_members(room_id: string): Promise<MemberRow[]> {
    return this.db
      .selectFrom("room_members")
      .innerJoin("users", "users.id", "room_members.user_id")
      .select([
        "room_members.user_id",
        "users.display_name",
        "room_members.role",
        "room_members.joined_at",
      ])
      .where("room_members.room_id", "=", room_id)
      .where("users.deleted_at", "is", null)
      .orderBy(sql`room_members.role = 'owner'`, "desc")
      .orderBy("room_members.joined_at")
      .execute();
  }

  async find_member_role(room_id: string, user_id: string): Promise<string | undefined> {
    const row = await this.db
      .selectFrom("room_members")
      .select("role")
      .where("room_id", "=", room_id)
      .where("user_id", "=", user_id)
      .executeTakeFirst();
    return row?.role;
  }

  async count_members(room_id: string): Promise<number> {
    const row = await this.db
      .selectFrom("room_members")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("room_id", "=", room_id)
      .executeTakeFirstOrThrow();
    return row.count;
  }

  add_member(room_id: string, user_id: string, now: Date): Promise<AddMemberResult> {
    return this.db.transaction().execute(async (trx) => {
      const room = await trx
        .selectFrom("rooms")
        .select("max_members")
        .where("id", "=", room_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const existing = await trx
        .selectFrom("room_members")
        .select("id")
        .where("room_id", "=", room_id)
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (existing) {
        return "already_member";
      }
      const { count } = await trx
        .selectFrom("room_members")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("room_id", "=", room_id)
        .executeTakeFirstOrThrow();
      if (count >= room.max_members) {
        return "full";
      }
      await trx
        .insertInto("room_members")
        .values({ room_id, user_id, role: "member", joined_at: now })
        .execute();
      return "added";
    });
  }

  async remove_member(room_id: string, user_id: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("room_members")
      .where("room_id", "=", room_id)
      .where("user_id", "=", user_id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }

  async find_question(question_id: string): Promise<QuestionRow | undefined> {
    const row = await this.db
      .selectFrom("room_questions")
      .select(QUESTION_COLUMNS)
      .where("id", "=", question_id)
      .executeTakeFirst();
    return row ? to_question(row) : undefined;
  }

  async find_question_by_slot(
    room_id: string,
    slot_index: number,
  ): Promise<QuestionRow | undefined> {
    const row = await this.db
      .selectFrom("room_questions")
      .select(QUESTION_COLUMNS)
      .where("room_id", "=", room_id)
      .where("slot_index", "=", slot_index)
      .executeTakeFirst();
    return row ? to_question(row) : undefined;
  }

  async insert_question(
    room_id: string,
    slot_index: number,
    question: RoomQuestionDraft & { source: string },
    window: { opens_at: Date; locks_at: Date },
  ): Promise<void> {
    await this.db
      .insertInto("room_questions")
      .values({
        room_id,
        slot_index,
        question_type: question.question_type,
        prompt: question.prompt,
        options: JSON.stringify(question.options),
        correct_option: question.correct_option,
        points: question.points,
        opens_at: window.opens_at,
        locks_at: window.locks_at,
        source: question.source,
      })
      .onConflict((conflict) =>
        conflict.constraint("room_questions_room_id_slot_index_unique").doNothing(),
      )
      .execute();
  }

  async list_used_prompts(room_id: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom("room_questions")
      .select("prompt")
      .where("room_id", "=", room_id)
      .execute();
    return rows.map((row) => row.prompt);
  }

  async list_revealed_questions(room_id: string, now: Date, limit: number): Promise<QuestionRow[]> {
    const rows = await this.db
      .selectFrom("room_questions")
      .select(QUESTION_COLUMNS)
      .where("room_id", "=", room_id)
      .where("locks_at", "<=", now)
      .orderBy("slot_index", "desc")
      .limit(limit)
      .execute();
    return rows.map(to_question);
  }

  async list_answers(question_ids: readonly string[]): Promise<AnswerRow[]> {
    if (question_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("room_answers")
      .innerJoin("users", "users.id", "room_answers.user_id")
      .select([
        "room_answers.question_id",
        "room_answers.user_id",
        "users.display_name",
        "room_answers.option",
        "room_answers.points_awarded",
        "room_answers.created_at",
      ])
      .where("room_answers.question_id", "in", [...question_ids])
      .execute();
  }

  async count_answers(question_id: string): Promise<number> {
    const row = await this.db
      .selectFrom("room_answers")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("question_id", "=", question_id)
      .executeTakeFirstOrThrow();
    return row.count;
  }

  find_answer(question_id: string, user_id: string): Promise<AnswerRow | undefined> {
    return this.db
      .selectFrom("room_answers")
      .innerJoin("users", "users.id", "room_answers.user_id")
      .select([
        "room_answers.question_id",
        "room_answers.user_id",
        "users.display_name",
        "room_answers.option",
        "room_answers.points_awarded",
        "room_answers.created_at",
      ])
      .where("room_answers.question_id", "=", question_id)
      .where("room_answers.user_id", "=", user_id)
      .executeTakeFirst();
  }

  insert_answer(
    question_id: string,
    user_id: string,
    option: string,
    points_awarded: number,
    now: Date,
  ): Promise<{ created_at: Date } | undefined> {
    return this.db
      .insertInto("room_answers")
      .values({ question_id, user_id, option, points_awarded, created_at: now })
      .onConflict((conflict) =>
        conflict.constraint("room_answers_question_id_user_id_unique").doNothing(),
      )
      .returning("created_at")
      .executeTakeFirst();
  }

  async list_reactions(question_ids: readonly string[]): Promise<ReactionRow[]> {
    if (question_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("room_reactions")
      .select(["question_id", "user_id", "emoji"])
      .where("question_id", "in", [...question_ids])
      .execute();
  }

  async toggle_reaction(question_id: string, user_id: string, emoji: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const removed = await trx
        .deleteFrom("room_reactions")
        .where("question_id", "=", question_id)
        .where("user_id", "=", user_id)
        .where("emoji", "=", emoji)
        .executeTakeFirst();
      if (removed.numDeletedRows > 0n) {
        return;
      }
      await trx
        .insertInto("room_reactions")
        .values({ question_id, user_id, emoji })
        .onConflict((conflict) =>
          conflict.constraint("room_reactions_question_id_user_id_emoji_unique").doNothing(),
        )
        .execute();
    });
  }

  async list_room_points(room_ids: readonly string[], now: Date): Promise<RoomPointsRow[]> {
    if (room_ids.length === 0) {
      return [];
    }
    return this.db
      .selectFrom("room_answers")
      .innerJoin("room_questions", "room_questions.id", "room_answers.question_id")
      .innerJoin("room_members", (join) =>
        join
          .onRef("room_members.room_id", "=", "room_questions.room_id")
          .onRef("room_members.user_id", "=", "room_answers.user_id"),
      )
      .select([
        "room_questions.room_id",
        "room_answers.user_id",
        sql<number>`sum(room_answers.points_awarded)::int`.as("points"),
      ])
      .where("room_questions.room_id", "in", [...room_ids])
      .where("room_questions.locks_at", "<=", now)
      .groupBy(["room_questions.room_id", "room_answers.user_id"])
      .execute();
  }

  list_answer_stats(room_id: string, now: Date, since: Date | null): Promise<AnswerStatsRow[]> {
    let query = this.db
      .selectFrom("room_answers")
      .innerJoin("room_questions", "room_questions.id", "room_answers.question_id")
      .select([
        "room_answers.user_id",
        sql<number>`sum(room_answers.points_awarded)::int`.as("points"),
        sql<number>`count(*)::int`.as("answers"),
        sql<number>`count(*) FILTER (WHERE room_questions.question_type = 'trivia')::int`.as(
          "trivia_answers",
        ),
        sql<number>`count(*) FILTER (WHERE room_answers.option = room_questions.correct_option)::int`.as(
          "trivia_correct",
        ),
      ])
      .where("room_questions.room_id", "=", room_id)
      .where("room_questions.locks_at", "<=", now)
      .groupBy("room_answers.user_id");
    if (since !== null) {
      query = query.where("room_questions.opens_at", ">=", since);
    }
    return query.execute();
  }
}
