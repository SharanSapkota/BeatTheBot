import { z } from "zod";
import { api_success_schema } from "./api_response";

// Rooms (step 9): a group's private room with a join key, a new question every interval,
// the room's own scoreboard and emoji reactions. Room points never count on the global
// leaderboard. Rules: docs/architecture.md → Rooms.

export const ROOM_TOPICS = ["hockey", "football", "basketball", "general_sports"] as const;
export const room_topic_schema = z.enum(ROOM_TOPICS);

/** Question speeds the owner can pick (seconds). */
export const ROOM_INTERVALS = [60, 300, 900, 3600] as const;
export const room_interval_schema = z.union(ROOM_INTERVALS.map((value) => z.literal(value)));

export const ROOM_EMOJIS = ["🔥", "😂", "😮", "👏", "😡"] as const;
export const room_emoji_schema = z.enum(ROOM_EMOJIS);

export const ROOM_NAME_MIN_LENGTH = 3;
export const ROOM_NAME_MAX_LENGTH = 40;
export const ROOM_MAX_MEMBERS = 100;
/** Active rooms one user may own. */
export const ROOM_MAX_OWNED = 10;

/** Generated keys use this alphabet: no 0/O/1/I/L, so a key is easy to read aloud. */
export const JOIN_KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const JOIN_KEY_LENGTH = 6;

/**
 * A typed key: spaces and dashes removed, upper case. Any 6 letters or digits are accepted
 * (the seeded demo key DEMO26 has an "O"); an unknown key is just "not found".
 */
export const join_key_input_schema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "A key has 6 letters or digits"));

export const room_status_schema = z.enum(["active", "closed"]);
export const room_role_schema = z.enum(["owner", "member"]);
export const room_question_type_schema = z.enum(["trivia", "opinion"]);

const room_name_schema = z.string().trim().min(ROOM_NAME_MIN_LENGTH).max(ROOM_NAME_MAX_LENGTH);

/** POST /rooms. The interval is checked by the API (the list above). */
export const create_room_request_schema = z.object({
  name: room_name_schema,
  topic: room_topic_schema,
  question_interval_seconds: z.number().int().positive(),
});

/** PATCH /rooms/:id (owner). */
export const update_room_request_schema = z
  .object({
    name: room_name_schema.optional(),
    question_interval_seconds: z.number().int().positive().optional(),
  })
  .refine((value) => value.name !== undefined || value.question_interval_seconds !== undefined, {
    message: "Change the name or the interval",
  });

/** POST /rooms/join */
export const join_room_request_schema = z.object({ key: join_key_input_schema });

export const room_member_schema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  role: room_role_schema,
  joined_at: z.string(),
  is_me: z.boolean(),
});

/** GET /me/rooms: one row per room the user is in. */
export const room_summary_schema = z.object({
  id: z.uuid(),
  name: z.string(),
  topic: room_topic_schema,
  status: room_status_schema,
  is_demo: z.boolean(),
  question_interval_seconds: z.number().int(),
  member_count: z.number().int().min(0),
  my_role: room_role_schema,
  /** All-time rank in the room; null before anyone has points. */
  my_rank: z.number().int().min(1).nullable(),
  my_points: z.number().int(),
});

/** GET /rooms/:id (members only). The key is shown to every member so they can invite. */
export const room_detail_schema = room_summary_schema.extend({
  join_key: z.string(),
  max_members: z.number().int(),
  owner_id: z.uuid(),
  created_at: z.string(),
  members: z.array(room_member_schema),
});

export const room_option_schema = z.object({ id: z.string(), label: z.string() });

const room_question_base_schema = z.object({
  id: z.uuid(),
  room_id: z.uuid(),
  slot_index: z.number().int().min(0),
  question_type: room_question_type_schema,
  prompt: z.string(),
  options: z.array(room_option_schema),
  points: z.number().int(),
  opens_at: z.string(),
  locks_at: z.string(),
  answer_count: z.number().int().min(0),
  /** The user's option, or null. */
  my_answer: z.string().nullable(),
});

/** GET /rooms/:id/current_question: open for the whole slot; no correct answer, no split. */
export const room_current_question_schema = room_question_base_schema.extend({
  seconds_left: z.number().int().min(0),
  member_count: z.number().int().min(0),
});

export const room_reaction_count_schema = z.object({
  emoji: room_emoji_schema,
  count: z.number().int().min(0),
  mine: z.boolean(),
});

/** A past question with its reveal. */
export const room_revealed_question_schema = room_question_base_schema.extend({
  /** Null for opinion questions. */
  correct_option: z.string().nullable(),
  split: z.array(
    z.object({
      option_id: z.string(),
      count: z.number().int().min(0),
      share: z.number().min(0).max(1),
    }),
  ),
  /** Trivia: names of the members who got it right. Opinion: empty. */
  right_names: z.array(z.string()),
  my_points: z.number().int().nullable(),
  reactions: z.array(room_reaction_count_schema),
});

export const room_current_response_data_schema = z.object({
  /** Null when the room is closed. */
  question: room_current_question_schema.nullable(),
});

export const room_questions_query_schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** POST /room_questions/:id/answers */
export const room_answer_request_schema = z.object({ option: z.string().min(1).max(10) });

/** The answer is saved; right/wrong and points show at the reveal. */
export const room_answer_schema = z.object({
  question_id: z.uuid(),
  option: z.string(),
  answered_at: z.string(),
});

/** POST /room_questions/:id/reactions (toggle) */
export const room_reaction_request_schema = z.object({ emoji: room_emoji_schema });

export const room_reactions_schema = z.object({
  question_id: z.uuid(),
  reactions: z.array(room_reaction_count_schema),
});

export const room_leaderboard_period_schema = z.enum(["week", "all"]);
export const room_leaderboard_query_schema = z.object({
  period: room_leaderboard_period_schema.default("week"),
});

/** GET /rooms/:id/leaderboard: every member, revealed questions only. */
export const room_leaderboard_schema = z.object({
  period: room_leaderboard_period_schema,
  rows: z.array(
    z.object({
      rank: z.number().int().min(1),
      kind: z.enum(["user", "you"]),
      display_name: z.string(),
      points: z.number().int(),
      answers: z.number().int().min(0),
      /** Right trivia answers / trivia answers; null without trivia answers. */
      correct_share: z.number().min(0).max(1).nullable(),
    }),
  ),
});

export const room_summaries_response_schema = api_success_schema(z.array(room_summary_schema));
export const room_detail_response_schema = api_success_schema(room_detail_schema);
export const room_current_response_schema = api_success_schema(room_current_response_data_schema);
export const room_questions_response_schema = api_success_schema(
  z.array(room_revealed_question_schema),
);
export const room_answer_response_schema = api_success_schema(room_answer_schema);
export const room_reactions_response_schema = api_success_schema(room_reactions_schema);
export const room_leaderboard_response_schema = api_success_schema(room_leaderboard_schema);

export type RoomTopic = z.infer<typeof room_topic_schema>;
export type RoomEmoji = z.infer<typeof room_emoji_schema>;
export type RoomStatus = z.infer<typeof room_status_schema>;
export type RoomRole = z.infer<typeof room_role_schema>;
export type RoomQuestionType = z.infer<typeof room_question_type_schema>;
export type CreateRoomRequest = z.infer<typeof create_room_request_schema>;
export type UpdateRoomRequest = z.infer<typeof update_room_request_schema>;
export type RoomMember = z.infer<typeof room_member_schema>;
export type RoomSummary = z.infer<typeof room_summary_schema>;
export type RoomDetail = z.infer<typeof room_detail_schema>;
export type RoomOption = z.infer<typeof room_option_schema>;
export type RoomCurrentQuestion = z.infer<typeof room_current_question_schema>;
export type RoomRevealedQuestion = z.infer<typeof room_revealed_question_schema>;
export type RoomReactionCount = z.infer<typeof room_reaction_count_schema>;
export type RoomCurrent = z.infer<typeof room_current_response_data_schema>;
export type RoomAnswer = z.infer<typeof room_answer_schema>;
export type RoomReactions = z.infer<typeof room_reactions_schema>;
export type RoomLeaderboardPeriod = z.infer<typeof room_leaderboard_period_schema>;
export type RoomLeaderboard = z.infer<typeof room_leaderboard_schema>;
