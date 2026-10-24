import { sql, type Kysely } from "kysely";
import { add_updated_at_trigger, is_one_of, with_id, with_timestamps } from "../migration_helpers";

// Rooms (step 9): a private room with a join key, a new question every interval, the room's own
// scoreboard and emoji reactions. Room points never count on the global leaderboard.
const TOPICS = ["hockey", "football", "basketball", "general_sports"];
const ROOM_STATUSES = ["active", "closed"];
const MEMBER_ROLES = ["owner", "member"];
const QUESTION_TYPES = ["trivia", "opinion"];
const QUESTION_SOURCES = ["mock", "llm"];
const EMOJIS = ["🔥", "😂", "😮", "👏", "😡"];

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("rooms")
    .$call(with_id)
    .addColumn("name", "text", (column) =>
      column.notNull().check(sql`char_length(name) BETWEEN 3 AND 40`),
    )
    .addColumn("topic", "text", (column) => column.notNull().check(is_one_of("topic", TOPICS)))
    .addColumn("join_key", "text", (column) => column.notNull().unique())
    .addColumn("owner_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    // The API allows 60 | 300 | 900 | 3600; any positive value is stored.
    .addColumn("question_interval_seconds", "integer", (column) =>
      column.notNull().check(sql`question_interval_seconds > 0`),
    )
    .addColumn("max_members", "integer", (column) => column.notNull().defaultTo(100))
    .addColumn("status", "text", (column) =>
      column.notNull().defaultTo("active").check(is_one_of("status", ROOM_STATUSES)),
    )
    .addColumn("is_demo", "boolean", (column) => column.notNull().defaultTo(false))
    // Slot = slot_base + floor((now - schedule_started_at) / interval). Starts at created_at and
    // slot 0; a new interval restarts the schedule after the current slot.
    .addColumn("schedule_started_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("slot_base", "integer", (column) => column.notNull().defaultTo(0))
    .$call(with_timestamps)
    .execute();
  await db.schema.createIndex("rooms_owner_id_index").on("rooms").column("owner_id").execute();

  await db.schema
    .createTable("room_members")
    .$call(with_id)
    .addColumn("room_id", "uuid", (column) =>
      column.notNull().references("rooms.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("role", "text", (column) =>
      column.notNull().defaultTo("member").check(is_one_of("role", MEMBER_ROLES)),
    )
    .addColumn("joined_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .$call(with_timestamps)
    .addUniqueConstraint("room_members_room_id_user_id_unique", ["room_id", "user_id"])
    .execute();
  await db.schema
    .createIndex("room_members_user_id_index")
    .on("room_members")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("room_questions")
    .$call(with_id)
    .addColumn("room_id", "uuid", (column) =>
      column.notNull().references("rooms.id").onDelete("cascade"),
    )
    .addColumn("slot_index", "integer", (column) => column.notNull())
    .addColumn("question_type", "text", (column) =>
      column.notNull().check(is_one_of("question_type", QUESTION_TYPES)),
    )
    .addColumn("prompt", "text", (column) => column.notNull())
    // [{ id, label }] in the shown order.
    .addColumn("options", "jsonb", (column) => column.notNull())
    .addColumn("correct_option", "text")
    .addColumn("points", "integer", (column) => column.notNull())
    .addColumn("opens_at", "timestamptz", (column) => column.notNull())
    .addColumn("locks_at", "timestamptz", (column) => column.notNull())
    .addColumn("source", "text", (column) =>
      column.notNull().defaultTo("mock").check(is_one_of("source", QUESTION_SOURCES)),
    )
    .$call(with_timestamps)
    // The current question is created on the first request of its slot; this makes it safe.
    .addUniqueConstraint("room_questions_room_id_slot_index_unique", ["room_id", "slot_index"])
    .addCheckConstraint(
      "room_questions_correct_option_check",
      sql`(question_type = 'opinion') = (correct_option IS NULL)`,
    )
    .execute();

  await db.schema
    .createTable("room_answers")
    .$call(with_id)
    .addColumn("question_id", "uuid", (column) =>
      column.notNull().references("room_questions.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("option", "text", (column) => column.notNull())
    // Set when the answer is saved (server side), shown only after the reveal.
    .addColumn("points_awarded", "integer", (column) => column.notNull())
    .$call(with_timestamps)
    .addUniqueConstraint("room_answers_question_id_user_id_unique", ["question_id", "user_id"])
    .execute();
  await db.schema
    .createIndex("room_answers_user_id_index")
    .on("room_answers")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("room_reactions")
    .$call(with_id)
    .addColumn("question_id", "uuid", (column) =>
      column.notNull().references("room_questions.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (column) =>
      column.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("emoji", "text", (column) => column.notNull().check(is_one_of("emoji", EMOJIS)))
    .addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("room_reactions_question_id_user_id_emoji_unique", [
      "question_id",
      "user_id",
      "emoji",
    ])
    .execute();

  for (const table_name of ["rooms", "room_members", "room_questions", "room_answers"]) {
    await add_updated_at_trigger(db, table_name);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table_name of [
    "room_reactions",
    "room_answers",
    "room_questions",
    "room_members",
    "rooms",
  ]) {
    await db.schema.dropTable(table_name).execute();
  }
}
