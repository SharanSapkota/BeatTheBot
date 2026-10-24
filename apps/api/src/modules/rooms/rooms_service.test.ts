import { ROOM_MAX_OWNED } from "@voita_kone/shared_types";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../common/app_error";
import type { GeneratedQuestion, QuestionGenerator } from "./question_generator";
import type {
  AddMemberResult,
  AnswerRow,
  AnswerStatsRow,
  MemberRow,
  MyRoomRow,
  NewRoom,
  QuestionRow,
  ReactionRow,
  RoomChanges,
  RoomPointsRow,
  RoomRow,
  RoomsRepository,
} from "./rooms_repository";
import { RoomsService } from "./rooms_service";

const START = new Date("2026-10-24T12:00:00.000Z");
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const FAN = "00000000-0000-4000-8000-0000000000b2";
const OUTSIDER = "00000000-0000-4000-8000-0000000000c3";
const NAMES: Record<string, string> = { [OWNER]: "Owner", [FAN]: "Fan", [OUTSIDER]: "Outsider" };

/** Just enough of the database for the service rules. */
class FakeRoomsRepository implements RoomsRepository {
  rooms: RoomRow[] = [];
  members: (MemberRow & { room_id: string })[] = [];
  questions: QuestionRow[] = [];
  answers: AnswerRow[] = [];
  reactions: ReactionRow[] = [];
  private next_id = 1;

  private id(): string {
    const id = `00000000-0000-4000-8000-${String(this.next_id).padStart(12, "0")}`;
    this.next_id += 1;
    return id;
  }

  insert_room(room: NewRoom): Promise<RoomRow | undefined> {
    if (this.rooms.some((row) => row.join_key === room.join_key)) {
      return Promise.resolve(undefined);
    }
    const row: RoomRow = {
      id: this.id(),
      name: room.name,
      topic: room.topic,
      join_key: room.join_key,
      owner_id: room.owner_id,
      question_interval_seconds: room.question_interval_seconds,
      max_members: 3,
      status: "active",
      is_demo: false,
      schedule_started_at: room.now,
      slot_base: 0,
      created_at: room.now,
    };
    this.rooms.push(row);
    this.members.push({
      room_id: row.id,
      user_id: room.owner_id,
      display_name: NAMES[room.owner_id] ?? "?",
      role: "owner",
      joined_at: room.now,
    });
    return Promise.resolve(row);
  }

  count_active_owned_rooms(user_id: string): Promise<number> {
    return Promise.resolve(
      this.rooms.filter((room) => room.owner_id === user_id && room.status === "active").length,
    );
  }

  find_room(room_id: string): Promise<RoomRow | undefined> {
    return Promise.resolve(this.rooms.find((room) => room.id === room_id));
  }

  find_room_by_key(join_key: string): Promise<RoomRow | undefined> {
    return Promise.resolve(this.rooms.find((room) => room.join_key === join_key));
  }

  update_room(room_id: string, changes: RoomChanges): Promise<void> {
    const room = this.rooms.find((row) => row.id === room_id);
    if (room) {
      Object.assign(room, changes);
    }
    return Promise.resolve();
  }

  set_join_key(room_id: string, join_key: string): Promise<string | undefined> {
    if (this.rooms.some((room) => room.join_key === join_key)) {
      return Promise.resolve(undefined);
    }
    const room = this.rooms.find((row) => row.id === room_id);
    if (room) {
      room.join_key = join_key;
    }
    return Promise.resolve(join_key);
  }

  set_status(room_id: string, status: string): Promise<void> {
    return this.update_room(room_id, {}).then(() => {
      const room = this.rooms.find((row) => row.id === room_id);
      if (room) {
        room.status = status;
      }
    });
  }

  list_my_rooms(user_id: string): Promise<MyRoomRow[]> {
    return Promise.resolve(
      this.members
        .filter((member) => member.user_id === user_id)
        .map((member) => {
          const room = this.rooms.find((row) => row.id === member.room_id) as RoomRow;
          return {
            ...room,
            my_role: member.role,
            member_count: this.members.filter((row) => row.room_id === room.id).length,
          };
        }),
    );
  }

  list_members(room_id: string): Promise<MemberRow[]> {
    return Promise.resolve(this.members.filter((member) => member.room_id === room_id));
  }

  find_member_role(room_id: string, user_id: string): Promise<string | undefined> {
    return Promise.resolve(
      this.members.find((member) => member.room_id === room_id && member.user_id === user_id)?.role,
    );
  }

  count_members(room_id: string): Promise<number> {
    return Promise.resolve(this.members.filter((member) => member.room_id === room_id).length);
  }

  add_member(room_id: string, user_id: string, now: Date): Promise<AddMemberResult> {
    const room = this.rooms.find((row) => row.id === room_id) as RoomRow;
    const in_room = this.members.filter((member) => member.room_id === room_id);
    if (in_room.some((member) => member.user_id === user_id)) {
      return Promise.resolve("already_member");
    }
    if (in_room.length >= room.max_members) {
      return Promise.resolve("full");
    }
    this.members.push({
      room_id,
      user_id,
      display_name: NAMES[user_id] ?? "?",
      role: "member",
      joined_at: now,
    });
    return Promise.resolve("added");
  }

  remove_member(room_id: string, user_id: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter(
      (member) => !(member.room_id === room_id && member.user_id === user_id),
    );
    return Promise.resolve(this.members.length < before);
  }

  find_question(question_id: string): Promise<QuestionRow | undefined> {
    return Promise.resolve(this.questions.find((question) => question.id === question_id));
  }

  find_question_by_slot(room_id: string, slot_index: number): Promise<QuestionRow | undefined> {
    return Promise.resolve(
      this.questions.find(
        (question) => question.room_id === room_id && question.slot_index === slot_index,
      ),
    );
  }

  insert_question(
    room_id: string,
    slot_index: number,
    question: GeneratedQuestion,
    window: { opens_at: Date; locks_at: Date },
  ): Promise<void> {
    if (!this.questions.some((row) => row.room_id === room_id && row.slot_index === slot_index)) {
      this.questions.push({ id: this.id(), room_id, slot_index, ...question, ...window });
    }
    return Promise.resolve();
  }

  list_used_prompts(room_id: string): Promise<string[]> {
    return Promise.resolve(
      this.questions.filter((row) => row.room_id === room_id).map((row) => row.prompt),
    );
  }

  list_revealed_questions(room_id: string, now: Date, limit: number): Promise<QuestionRow[]> {
    return Promise.resolve(
      this.questions
        .filter((row) => row.room_id === room_id && row.locks_at <= now)
        .sort((first, second) => second.slot_index - first.slot_index)
        .slice(0, limit),
    );
  }

  list_answers(question_ids: readonly string[]): Promise<AnswerRow[]> {
    return Promise.resolve(this.answers.filter((row) => question_ids.includes(row.question_id)));
  }

  count_answers(question_id: string): Promise<number> {
    return Promise.resolve(this.answers.filter((row) => row.question_id === question_id).length);
  }

  find_answer(question_id: string, user_id: string): Promise<AnswerRow | undefined> {
    return Promise.resolve(
      this.answers.find((row) => row.question_id === question_id && row.user_id === user_id),
    );
  }

  insert_answer(
    question_id: string,
    user_id: string,
    option: string,
    points_awarded: number,
    now: Date,
  ): Promise<{ created_at: Date } | undefined> {
    if (this.answers.some((row) => row.question_id === question_id && row.user_id === user_id)) {
      return Promise.resolve(undefined);
    }
    this.answers.push({
      question_id,
      user_id,
      display_name: NAMES[user_id] ?? "?",
      option,
      points_awarded,
      created_at: now,
    });
    return Promise.resolve({ created_at: now });
  }

  list_reactions(question_ids: readonly string[]): Promise<ReactionRow[]> {
    return Promise.resolve(this.reactions.filter((row) => question_ids.includes(row.question_id)));
  }

  toggle_reaction(question_id: string, user_id: string, emoji: string): Promise<void> {
    const matches = (row: ReactionRow) =>
      row.question_id === question_id && row.user_id === user_id && row.emoji === emoji;
    if (this.reactions.some(matches)) {
      this.reactions = this.reactions.filter((row) => !matches(row));
    } else {
      this.reactions.push({ question_id, user_id, emoji });
    }
    return Promise.resolve();
  }

  list_room_points(room_ids: readonly string[], now: Date): Promise<RoomPointsRow[]> {
    const points = new Map<string, RoomPointsRow>();
    for (const answer of this.answers) {
      const question = this.questions.find((row) => row.id === answer.question_id) as QuestionRow;
      if (!room_ids.includes(question.room_id) || question.locks_at > now) {
        continue;
      }
      const key = `${question.room_id}:${answer.user_id}`;
      const row = points.get(key) ?? {
        room_id: question.room_id,
        user_id: answer.user_id,
        points: 0,
      };
      row.points += answer.points_awarded;
      points.set(key, row);
    }
    return Promise.resolve([...points.values()]);
  }

  list_answer_stats(room_id: string, now: Date, since: Date | null): Promise<AnswerStatsRow[]> {
    const stats = new Map<string, AnswerStatsRow>();
    for (const answer of this.answers) {
      const question = this.questions.find((row) => row.id === answer.question_id) as QuestionRow;
      if (question.room_id !== room_id || question.locks_at > now) {
        continue;
      }
      if (since !== null && question.opens_at < since) {
        continue;
      }
      const row = stats.get(answer.user_id) ?? {
        user_id: answer.user_id,
        points: 0,
        answers: 0,
        trivia_answers: 0,
        trivia_correct: 0,
      };
      row.points += answer.points_awarded;
      row.answers += 1;
      if (question.question_type === "trivia") {
        row.trivia_answers += 1;
        row.trivia_correct += answer.option === question.correct_option ? 1 : 0;
      }
      stats.set(answer.user_id, row);
    }
    return Promise.resolve([...stats.values()]);
  }
}

/** Always the same trivia question; counts calls. */
class FixedGenerator implements QuestionGenerator {
  calls = 0;

  generate(): Promise<GeneratedQuestion> {
    this.calls += 1;
    return Promise.resolve({
      question_type: "trivia",
      prompt: `Which city is Kärpät's home? (${String(this.calls)})`,
      options: [
        { id: "a", label: "Oulu" },
        { id: "b", label: "Kuopio" },
      ],
      correct_option: "a",
      points: 3,
      source: "mock",
    });
  }
}

let repository: FakeRoomsRepository;
let generator: FixedGenerator;
let now: Date;
let service: RoomsService;

function later(seconds: number): void {
  now = new Date(now.getTime() + seconds * 1000);
}

async function error_code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("expected an AppError");
}

async function create_room() {
  return service.create(OWNER, {
    name: "Kärpät fans",
    topic: "hockey",
    question_interval_seconds: 60,
  });
}

beforeEach(() => {
  repository = new FakeRoomsRepository();
  generator = new FixedGenerator();
  now = START;
  service = new RoomsService(repository, generator, () => now);
});

describe("create and join", () => {
  it("creates a room with a readable key and the owner as a member", async () => {
    const room = await create_room();
    expect(room.join_key).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(room.my_role).toBe("owner");
    expect(room.members.map((member) => member.display_name)).toEqual(["Owner"]);
  });

  it("allows only the listed question speeds", async () => {
    const attempt = service.create(OWNER, {
      name: "Fast",
      topic: "hockey",
      question_interval_seconds: 5,
    });
    expect(await error_code(attempt)).toBe("INVALID_INTERVAL");
  });

  it("limits how many active rooms one user owns", async () => {
    for (let index = 0; index < ROOM_MAX_OWNED; index += 1) {
      await create_room();
    }
    expect(await error_code(create_room())).toBe("ROOM_LIMIT");
  });

  it("joins with the key; joining again is fine; a full room says so", async () => {
    const room = await create_room();
    const joined = await service.join(FAN, room.join_key);
    expect(joined.member_count).toBe(2);
    expect((await service.join(FAN, room.join_key)).member_count).toBe(2);
    await service.join(OUTSIDER, room.join_key);
    expect(
      await error_code(service.join("00000000-0000-4000-8000-0000000000d4", room.join_key)),
    ).toBe("ROOM_FULL");
  });

  it("does not find an unknown key and can't join a closed room", async () => {
    expect(await error_code(service.join(FAN, "ZZZZZZ"))).toBe("ROOM_NOT_FOUND");
    const room = await create_room();
    await service.close(room.id, OWNER);
    expect(await error_code(service.join(FAN, room.join_key))).toBe("ROOM_CLOSED");
  });

  it("lets only the owner regenerate the key", async () => {
    const room = await create_room();
    await service.join(FAN, room.join_key);
    expect(await error_code(service.regenerate_key(room.id, FAN))).toBe("NOT_ROOM_OWNER");
    const changed = await service.regenerate_key(room.id, OWNER);
    expect(changed.join_key).not.toBe(room.join_key);
  });
});

describe("members", () => {
  it("is private: a non-member gets 403", async () => {
    const room = await create_room();
    expect(await error_code(service.get(room.id, OUTSIDER))).toBe("NOT_A_MEMBER");
    expect(await error_code(service.current_question(room.id, OUTSIDER))).toBe("NOT_A_MEMBER");
  });

  it("lets a member leave and the owner remove members, but not the owner", async () => {
    const room = await create_room();
    await service.join(FAN, room.join_key);
    await service.join(OUTSIDER, room.join_key);
    expect(await error_code(service.remove_member(room.id, FAN, OUTSIDER))).toBe("NOT_ROOM_OWNER");
    await service.remove_member(room.id, FAN, FAN);
    await service.remove_member(room.id, OWNER, OUTSIDER);
    expect(await error_code(service.remove_member(room.id, OWNER, OWNER))).toBe(
      "OWNER_CANNOT_LEAVE",
    );
    expect((await service.get(room.id, OWNER)).member_count).toBe(1);
  });
});

describe("questions", () => {
  it("creates the current question once per slot and a new one in the next slot", async () => {
    const room = await create_room();
    const first = await service.current_question(room.id, OWNER);
    const again = await service.current_question(room.id, OWNER);
    expect(again.question?.id).toBe(first.question?.id);
    expect(first.question?.seconds_left).toBe(60);
    expect(generator.calls).toBe(1);
    later(60);
    const next = await service.current_question(room.id, OWNER);
    expect(next.question?.slot_index).toBe(1);
    expect(generator.calls).toBe(2);
  });

  it("scores on the server, once, and locks at the next slot", async () => {
    const room = await create_room();
    await service.join(FAN, room.join_key);
    const { question } = await service.current_question(room.id, OWNER);
    const question_id = question?.id ?? "";
    await service.answer(question_id, OWNER, "a");
    await service.answer(question_id, FAN, "b");
    expect(await error_code(service.answer(question_id, FAN, "a"))).toBe("ALREADY_ANSWERED");
    expect(await error_code(service.answer(question_id, OUTSIDER, "a"))).toBe("NOT_A_MEMBER");
    later(60);
    expect(await error_code(service.answer(question_id, OWNER, "a"))).toBe("QUESTION_LOCKED");

    const [revealed] = await service.past_questions(room.id, FAN, 20);
    expect(revealed?.correct_option).toBe("a");
    expect(revealed?.split).toEqual([
      { option_id: "a", count: 1, share: 0.5 },
      { option_id: "b", count: 1, share: 0.5 },
    ]);
    expect(revealed?.right_names).toEqual(["Owner"]);
    expect(revealed?.my_points).toBe(0);
  });

  it("rejects an option that is not on the question", async () => {
    const room = await create_room();
    const { question } = await service.current_question(room.id, OWNER);
    expect(await error_code(service.answer(question?.id ?? "", OWNER, "z"))).toBe("INVALID_ANSWER");
  });

  it("hides open questions from the past list and the scoreboard", async () => {
    const room = await create_room();
    const { question } = await service.current_question(room.id, OWNER);
    await service.answer(question?.id ?? "", OWNER, "a");
    expect(await service.past_questions(room.id, OWNER, 20)).toEqual([]);
    const board = await service.leaderboard(room.id, OWNER, "all");
    expect(board.rows[0]?.points).toBe(0);
  });

  it("toggles a reaction", async () => {
    const room = await create_room();
    const { question } = await service.current_question(room.id, OWNER);
    const added = await service.toggle_reaction(question?.id ?? "", OWNER, "🔥");
    expect(added.reactions[0]).toEqual({ emoji: "🔥", count: 1, mine: true });
    const removed = await service.toggle_reaction(question?.id ?? "", OWNER, "🔥");
    expect(removed.reactions[0]).toEqual({ emoji: "🔥", count: 0, mine: false });
  });

  it("has no current question in a closed room", async () => {
    const room = await create_room();
    await service.close(room.id, OWNER);
    expect(await service.current_question(room.id, OWNER)).toEqual({ question: null });
  });

  it("starts a new interval after the current slot", async () => {
    const room = await create_room();
    later(30);
    await service.update(room.id, OWNER, { question_interval_seconds: 300 });
    const stored = repository.rooms[0] as RoomRow;
    expect(stored.slot_base).toBe(1);
    expect(stored.schedule_started_at).toEqual(new Date(START.getTime() + 60_000));
  });
});

describe("leaderboard", () => {
  it("ranks every member with points, answers and correct share", async () => {
    const room = await create_room();
    await service.join(FAN, room.join_key);
    const { question } = await service.current_question(room.id, OWNER);
    await service.answer(question?.id ?? "", FAN, "a");
    await service.answer(question?.id ?? "", OWNER, "b");
    later(60);
    const board = await service.leaderboard(room.id, FAN, "week");
    expect(board.rows).toEqual([
      { rank: 1, kind: "you", display_name: "Fan", points: 3, answers: 1, correct_share: 1 },
      { rank: 2, kind: "user", display_name: "Owner", points: 0, answers: 1, correct_share: 0 },
    ]);
    const mine = await service.list_mine(FAN);
    expect(mine[0]?.my_rank).toBe(1);
    expect(mine[0]?.my_points).toBe(3);
  });
});
