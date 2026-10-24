import {
  ROOM_INTERVALS,
  ROOM_MAX_OWNED,
  type CreateRoomRequest,
  type RoomAnswer,
  type RoomCurrent,
  type RoomDetail,
  type RoomEmoji,
  type RoomLeaderboard,
  type RoomLeaderboardPeriod,
  type RoomReactions,
  type RoomRevealedQuestion,
  type RoomRole,
  type RoomStatus,
  type RoomSummary,
  type RoomTopic,
  type RoomQuestionType,
  type UpdateRoomRequest,
} from "@voita_kone/shared_types";
import { score_room_answer } from "@voita_kone/scoring";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { rank_entries } from "../leaderboard/leaderboard_builder";
import { week_start } from "../leaderboard/leaderboard_week";
import { with_unique_join_key } from "./join_key";
import type { QuestionGenerator } from "./question_generator";
import { build_split, count_reactions, right_names } from "./room_reveal";
import {
  current_slot,
  is_revealed,
  schedule_after_interval_change,
  seconds_left,
} from "./room_slots";
import type {
  AnswerRow,
  QuestionRow,
  RoomPointsRow,
  RoomRow,
  RoomsRepository,
} from "./rooms_repository";

export interface RoomsConfig {
  /** Question speeds the owner may pick (seconds). */
  allowed_intervals: readonly number[];
}

export const DEFAULT_ROOMS_CONFIG: RoomsConfig = { allowed_intervals: ROOM_INTERVALS };

export function room_not_found(): AppError {
  return new AppError("ROOM_NOT_FOUND", 404, "No room found");
}

export function question_not_found(): AppError {
  return new AppError("QUESTION_NOT_FOUND", 404, "No question found");
}

export function member_not_found(): AppError {
  return new AppError("MEMBER_NOT_FOUND", 404, "This user is not in the room");
}

function not_a_member(): AppError {
  return new AppError("NOT_A_MEMBER", 403, "Only members of this room can see this");
}

function not_owner(): AppError {
  return new AppError("NOT_ROOM_OWNER", 403, "Only the room's owner can do this");
}

function room_closed(): AppError {
  return new AppError("ROOM_CLOSED", 409, "This room is closed");
}

/**
 * All-time rank of a user in a room; null while nobody has points. Members without points share
 * the last rank, so they don't need to be listed.
 */
function rank_in_room(points: readonly RoomPointsRow[], user_id: string): number | null {
  if (!points.some((row) => row.points > 0)) {
    return null;
  }
  const entries = points.map((row) => ({ id: row.user_id, display_name: "", points: row.points }));
  if (!entries.some((entry) => entry.id === user_id)) {
    entries.push({ id: user_id, display_name: "", points: 0 });
  }
  return rank_entries(entries).find((entry) => entry.id === user_id)?.rank ?? null;
}

/** Rooms: create, join with a key, members, the current question, reveals, reactions, scoreboard. */
export class RoomsService {
  constructor(
    private readonly repository: RoomsRepository,
    private readonly generator: QuestionGenerator,
    private readonly clock: Clock,
    private readonly config: RoomsConfig = DEFAULT_ROOMS_CONFIG,
  ) {}

  async create(user_id: string, request: CreateRoomRequest): Promise<RoomDetail> {
    this.check_interval(request.question_interval_seconds);
    if ((await this.repository.count_active_owned_rooms(user_id)) >= ROOM_MAX_OWNED) {
      throw new AppError(
        "ROOM_LIMIT",
        409,
        `You can own up to ${String(ROOM_MAX_OWNED)} active rooms. Close one first.`,
      );
    }
    const now = this.clock();
    const room = await with_unique_join_key((join_key) =>
      this.repository.insert_room({ ...request, join_key, owner_id: user_id, now }),
    );
    return this.detail(room, user_id);
  }

  async list_mine(user_id: string): Promise<RoomSummary[]> {
    const rooms = await this.repository.list_my_rooms(user_id);
    const points = await this.repository.list_room_points(
      rooms.map((room) => room.id),
      this.clock(),
    );
    return rooms.map((room) => {
      const room_points = points.filter((row) => row.room_id === room.id);
      return {
        ...this.summary_fields(room),
        member_count: room.member_count,
        my_role: room.my_role as RoomRole,
        my_rank: rank_in_room(room_points, user_id),
        my_points: room_points.find((row) => row.user_id === user_id)?.points ?? 0,
      };
    });
  }

  async get(room_id: string, user_id: string): Promise<RoomDetail> {
    const room = await this.member_room(room_id, user_id);
    return this.detail(room, user_id);
  }

  async update(room_id: string, user_id: string, request: UpdateRoomRequest): Promise<RoomDetail> {
    const room = await this.owner_room(room_id, user_id);
    const interval = request.question_interval_seconds;
    if (interval !== undefined) {
      this.check_interval(interval);
    }
    const schedule =
      interval !== undefined && interval !== room.question_interval_seconds
        ? schedule_after_interval_change(room, interval, this.clock())
        : {};
    await this.repository.update_room(room_id, {
      ...(request.name === undefined ? {} : { name: request.name }),
      ...schedule,
    });
    return this.get(room_id, user_id);
  }

  async regenerate_key(room_id: string, user_id: string): Promise<RoomDetail> {
    const room = await this.owner_room(room_id, user_id);
    if (room.status !== "active") {
      throw room_closed();
    }
    await with_unique_join_key((join_key) => this.repository.set_join_key(room_id, join_key));
    return this.get(room_id, user_id);
  }

  async close(room_id: string, user_id: string): Promise<RoomDetail> {
    await this.owner_room(room_id, user_id);
    await this.repository.set_status(room_id, "closed");
    return this.get(room_id, user_id);
  }

  /** Joining again is fine (already a member = the same room back). */
  async join(user_id: string, join_key: string): Promise<RoomDetail> {
    const room = await this.repository.find_room_by_key(join_key);
    if (!room) {
      throw new AppError("ROOM_NOT_FOUND", 404, "No room with this key");
    }
    if (room.status !== "active") {
      throw room_closed();
    }
    const result = await this.repository.add_member(room.id, user_id, this.clock());
    if (result === "full") {
      throw new AppError("ROOM_FULL", 409, "This room is full");
    }
    return this.detail(room, user_id);
  }

  /** The owner removes a member, or a member leaves. The owner can't leave (close instead). */
  async remove_member(room_id: string, actor_id: string, member_id: string): Promise<void> {
    const room = await this.member_room(room_id, actor_id);
    if (actor_id !== member_id && room.owner_id !== actor_id) {
      throw not_owner();
    }
    if (member_id === room.owner_id) {
      throw new AppError(
        "OWNER_CANNOT_LEAVE",
        409,
        "The owner can't leave the room. Close the room instead.",
      );
    }
    if (!(await this.repository.remove_member(room_id, member_id))) {
      throw member_not_found();
    }
  }

  /** The open question of the current slot, created on the first request for that slot. */
  async current_question(room_id: string, user_id: string): Promise<RoomCurrent> {
    const room = await this.member_room(room_id, user_id);
    if (room.status !== "active") {
      return { question: null };
    }
    const now = this.clock();
    const window = current_slot(room, now);
    let question = await this.repository.find_question_by_slot(room_id, window.slot_index);
    if (!question) {
      const generated = await this.generator.generate({
        topic: room.topic as RoomTopic,
        used_prompts: await this.repository.list_used_prompts(room_id),
        seed: `${room_id}:${String(window.slot_index)}`,
      });
      await this.repository.insert_question(room_id, window.slot_index, generated, window);
      question = await this.repository.find_question_by_slot(room_id, window.slot_index);
      if (!question) {
        throw new AppError("QUESTION_NOT_CREATED", 500, "Could not create the question");
      }
    }
    const [answer_count, my_answer, member_count] = await Promise.all([
      this.repository.count_answers(question.id),
      this.repository.find_answer(question.id, user_id),
      this.repository.count_members(room_id),
    ]);
    return {
      question: {
        ...this.question_fields(question),
        answer_count,
        my_answer: my_answer?.option ?? null,
        seconds_left: seconds_left(question.locks_at, now),
        member_count,
      },
    };
  }

  /** Past (locked) questions, newest first, with the reveal and reactions. */
  async past_questions(
    room_id: string,
    user_id: string,
    limit: number,
  ): Promise<RoomRevealedQuestion[]> {
    await this.member_room(room_id, user_id);
    const questions = await this.repository.list_revealed_questions(room_id, this.clock(), limit);
    const ids = questions.map((question) => question.id);
    const [answers, reactions] = await Promise.all([
      this.repository.list_answers(ids),
      this.repository.list_reactions(ids),
    ]);
    return questions.map((question) =>
      this.reveal(
        question,
        answers.filter((answer) => answer.question_id === question.id),
        reactions.filter((reaction) => reaction.question_id === question.id),
        user_id,
      ),
    );
  }

  /** Saves one answer while the question is open; points are stored now, shown at the reveal. */
  async answer(question_id: string, user_id: string, option: string): Promise<RoomAnswer> {
    const question = await this.repository.find_question(question_id);
    if (!question) {
      throw question_not_found();
    }
    const room = await this.member_room(question.room_id, user_id);
    if (room.status !== "active") {
      throw room_closed();
    }
    const now = this.clock();
    if (is_revealed(question.locks_at, now) || now < question.opens_at) {
      throw new AppError("QUESTION_LOCKED", 409, "This question is closed");
    }
    if (!question.options.some((candidate) => candidate.id === option)) {
      throw new AppError("INVALID_ANSWER", 400, "Pick one of the options");
    }
    const points = score_room_answer(
      {
        question_type: question.question_type as RoomQuestionType,
        correct_option: question.correct_option,
      },
      option,
    );
    const saved = await this.repository.insert_answer(question_id, user_id, option, points, now);
    if (!saved) {
      throw new AppError("ALREADY_ANSWERED", 409, "You already answered this question");
    }
    return { question_id, option, answered_at: saved.created_at.toISOString() };
  }

  /** Adds the emoji, or removes it when this user already reacted with it. */
  async toggle_reaction(
    question_id: string,
    user_id: string,
    emoji: RoomEmoji,
  ): Promise<RoomReactions> {
    const question = await this.repository.find_question(question_id);
    if (!question) {
      throw question_not_found();
    }
    await this.member_room(question.room_id, user_id);
    await this.repository.toggle_reaction(question_id, user_id, emoji);
    const reactions = await this.repository.list_reactions([question_id]);
    return { question_id, reactions: count_reactions(reactions, user_id) };
  }

  /** Every current member, ranked by points over revealed questions (this week or all time). */
  async leaderboard(
    room_id: string,
    user_id: string,
    period: RoomLeaderboardPeriod,
  ): Promise<RoomLeaderboard> {
    await this.member_room(room_id, user_id);
    const now = this.clock();
    const [members, stats] = await Promise.all([
      this.repository.list_members(room_id),
      this.repository.list_answer_stats(room_id, now, period === "week" ? week_start(now) : null),
    ]);
    const stats_by_user = new Map(stats.map((row) => [row.user_id, row]));
    const ranked = rank_entries(
      members.map((member) => ({
        id: member.user_id,
        display_name: member.display_name,
        points: stats_by_user.get(member.user_id)?.points ?? 0,
      })),
    );
    return {
      period,
      rows: ranked.map((entry) => {
        const row = stats_by_user.get(entry.id);
        return {
          rank: entry.rank,
          kind: entry.id === user_id ? "you" : "user",
          display_name: entry.display_name,
          points: entry.points,
          answers: row?.answers ?? 0,
          correct_share:
            row && row.trivia_answers > 0 ? row.trivia_correct / row.trivia_answers : null,
        };
      }),
    };
  }

  private check_interval(seconds: number): void {
    if (!this.config.allowed_intervals.includes(seconds)) {
      throw new AppError(
        "INVALID_INTERVAL",
        400,
        `Pick one of these question speeds: ${this.config.allowed_intervals.join(", ")} seconds`,
      );
    }
  }

  private async member_room(room_id: string, user_id: string): Promise<RoomRow> {
    const room = await this.repository.find_room(room_id);
    if (!room) {
      throw room_not_found();
    }
    if ((await this.repository.find_member_role(room_id, user_id)) === undefined) {
      throw not_a_member();
    }
    return room;
  }

  private async owner_room(room_id: string, user_id: string): Promise<RoomRow> {
    const room = await this.member_room(room_id, user_id);
    if (room.owner_id !== user_id) {
      throw not_owner();
    }
    return room;
  }

  private summary_fields(room: RoomRow) {
    return {
      id: room.id,
      name: room.name,
      topic: room.topic as RoomTopic,
      status: room.status as RoomStatus,
      is_demo: room.is_demo,
      question_interval_seconds: room.question_interval_seconds,
    };
  }

  private async detail(room: RoomRow, user_id: string): Promise<RoomDetail> {
    const now = this.clock();
    const [members, points] = await Promise.all([
      this.repository.list_members(room.id),
      this.repository.list_room_points([room.id], now),
    ]);
    const me = members.find((member) => member.user_id === user_id);
    return {
      ...this.summary_fields(room),
      member_count: members.length,
      my_role: (me?.role ?? "member") as RoomRole,
      my_rank: rank_in_room(points, user_id),
      my_points: points.find((row) => row.user_id === user_id)?.points ?? 0,
      join_key: room.join_key,
      max_members: room.max_members,
      owner_id: room.owner_id,
      created_at: room.created_at.toISOString(),
      members: members.map((member) => ({
        user_id: member.user_id,
        display_name: member.display_name,
        role: member.role as RoomRole,
        joined_at: member.joined_at.toISOString(),
        is_me: member.user_id === user_id,
      })),
    };
  }

  private question_fields(question: QuestionRow) {
    return {
      id: question.id,
      room_id: question.room_id,
      slot_index: question.slot_index,
      question_type: question.question_type as RoomQuestionType,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      opens_at: question.opens_at.toISOString(),
      locks_at: question.locks_at.toISOString(),
    };
  }

  private reveal(
    question: QuestionRow,
    answers: readonly AnswerRow[],
    reactions: readonly { emoji: string; user_id: string }[],
    user_id: string,
  ): RoomRevealedQuestion {
    const mine = answers.find((answer) => answer.user_id === user_id);
    return {
      ...this.question_fields(question),
      answer_count: answers.length,
      my_answer: mine?.option ?? null,
      correct_option: question.correct_option,
      split: build_split(question.options, answers),
      right_names: right_names(question.correct_option, answers),
      my_points: mine?.points_awarded ?? null,
      reactions: count_reactions(reactions, user_id),
    };
  }
}
