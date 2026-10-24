import type { Fact } from "@voita_kone/fact_checker";
import type { GameDetail, PlayerSummary } from "@voita_kone/shared_types";
import { describe, expect, it } from "vitest";
import type {
  AnswerCount,
  AnswerRow,
  NewQuestion,
  QuestionRow,
  QuestionsRepository,
} from "./questions_repository";
import { QuestionsService } from "./questions_service";

const NOW = new Date("2026-10-24T20:00:00.000Z");
const GAME_ID = "00000000-0000-4000-8000-0000000000aa";
const HOME = "00000000-0000-4000-8000-000000000001";
const AWAY = "00000000-0000-4000-8000-000000000002";
const LAINE = "00000000-0000-4000-8000-00000000000a";

function team(id: string, name: string) {
  return {
    id,
    external_id: name,
    name,
    short_name: name,
    city: null,
    logo_url: null,
    sport: "hockey" as const,
    data_source: "liiga_api" as const,
  };
}

function game(change: Partial<GameDetail> = {}): GameDetail {
  return {
    id: GAME_ID,
    sport: "hockey",
    league: { id: "00000000-0000-4000-8000-000000000001", name: "Liiga" },
    season: "2026-27",
    start_time: "2026-10-24T16:30:00.000Z",
    state: "final",
    period: 3,
    game_clock_seconds: null,
    home_team: team(HOME, "Kärpät"),
    away_team: team(AWAY, "KalPa"),
    home_goals: 1,
    away_goals: 0,
    ended_in: "regulation",
    featured: true,
    data_source: "liiga_api",
    events: [
      {
        id: "e1",
        event_type: "goal",
        period: 1,
        game_time_seconds: 877,
        team_id: HOME,
        player: { id: LAINE, first_name: "Eetu", last_name: "Laine", jersey_number: 10 },
        assists: [],
        penalty_minutes: null,
        score_after: { home: 1, away: 0 },
      },
    ],
    demo_replay: false,
    top_scorer: null,
    ...change,
  };
}

function player(
  id: string,
  first_name: string,
  last_name: string,
  season_goals: number,
): PlayerSummary {
  return {
    id,
    first_name,
    last_name,
    jersey_number: null,
    position: "forward",
    birth_year: null,
    season_goals,
    goals_last_5: 0,
  };
}

const PLAYERS = [
  player(LAINE, "Eetu", "Laine", 9),
  player("00000000-0000-4000-8000-00000000000b", "Joonas", "Niemi", 6),
  player("00000000-0000-4000-8000-00000000000c", "Ville", "Koskinen", 5),
  player("00000000-0000-4000-8000-00000000000d", "Teemu", "Pulkkinen", 4),
];

class FakeRepository implements QuestionsRepository {
  rows: (QuestionRow & { status: string })[] = [];
  answers: (AnswerRow & { user_id: string })[] = [];
  facts: Fact[] | undefined;

  insert_questions(game_id: string, questions: readonly NewQuestion[]): Promise<void> {
    for (const { draft, status } of questions) {
      if (!this.rows.some((row) => row.question_key === draft.key)) {
        this.rows.push({
          ...draft,
          id: `00000000-0000-4000-9000-${String(this.rows.length).padStart(12, "0")}`,
          game_id,
          question_key: draft.key,
          status,
        });
      }
    }
    return Promise.resolve();
  }
  list_questions(_game_id: string, phase: "live" | "after"): Promise<QuestionRow[]> {
    return Promise.resolve(this.rows.filter((row) => row.phase === phase && row.status === "live"));
  }
  find_question(question_id: string): Promise<QuestionRow | undefined> {
    return Promise.resolve(
      this.rows.find((row) => row.id === question_id && row.status === "live"),
    );
  }
  list_answers(user_id: string): Promise<AnswerRow[]> {
    return Promise.resolve(this.answers.filter((answer) => answer.user_id === user_id));
  }
  count_answers(): Promise<AnswerCount[]> {
    return Promise.resolve(
      this.answers.map((answer) => ({
        question_id: answer.question_id,
        answer: answer.answer,
        count: 1,
      })),
    );
  }
  insert_answer(
    user_id: string,
    question_id: string,
    answer: string,
    points_awarded: number | null,
  ): Promise<boolean> {
    if (this.answers.some((row) => row.user_id === user_id && row.question_id === question_id)) {
      return Promise.resolve(false);
    }
    this.answers.push({ user_id, question_id, answer, points_awarded });
    return Promise.resolve(true);
  }
  find_latest_facts(): Promise<Fact[] | undefined> {
    return Promise.resolve(this.facts);
  }
}

function create_service(detail: GameDetail = game(), now: Date = NOW) {
  const repository = new FakeRepository();
  const service = new QuestionsService(
    repository,
    { get_game_detail: () => Promise.resolve(detail) },
    { list_players: (team_id) => Promise.resolve(team_id === HOME ? PLAYERS : []) },
    () => now,
    { get_game_detail: () => Promise.resolve(detail) },
  );
  return { repository, service };
}

describe("QuestionsService.list", () => {
  it("creates the quiz from the game's facts and the vote, without showing the right answer", async () => {
    const { repository, service } = create_service();

    const questions = await service.list(GAME_ID, "after", null);

    expect(questions.map((question) => question.question_type)).toEqual([
      "result_quiz",
      "result_quiz",
      "player_vote",
    ]);
    expect(questions.every((question) => question.correct_option === null)).toBe(true);
    // Asking again keeps the same questions.
    await service.list(GAME_ID, "after", null);
    expect(repository.rows).toHaveLength(3);
  });

  it("creates the live picks while the game is live", async () => {
    const { service } = create_service(game({ state: "live", period: 2, ended_in: null }));

    const questions = await service.list(GAME_ID, "live", "u1");

    expect(questions.map((question) => [question.question_type, question.target])).toEqual([
      ["next_goal", 1],
      ["period_goal", 3],
      ["poll", null],
    ]);
  });
});

describe("QuestionsService.answer", () => {
  it("scores a quiz answer at once (2 points) and shows the explanation", async () => {
    const { service } = create_service();
    const [first] = await service.list(GAME_ID, "after", "u1");
    if (!first) {
      throw new Error("no quiz");
    }
    const right = first.options.find((option) => option.label === "Eetu Laine")?.id ?? "";

    const result = await service.answer("u1", first.id, right);

    expect(result).toMatchObject({ correct: true, points_awarded: 2, correct_option: right });
    expect(result.explanation).toContain("Correct!");
    const [answered] = await service.list(GAME_ID, "after", "u1");
    expect(answered?.my_answer).toEqual({ answer: right, points_awarded: 2 });
  });

  it("gives 1 point for a vote and shows the fans' shares after voting", async () => {
    const { service } = create_service();
    const vote = (await service.list(GAME_ID, "after", "u1")).find(
      (question) => question.question_type === "player_vote",
    );
    if (!vote) {
      throw new Error("no vote");
    }

    expect(await service.answer("u1", vote.id, LAINE)).toMatchObject({
      correct: null,
      points_awarded: 1,
    });
    const after_vote = (await service.list(GAME_ID, "after", "u1")).find(
      (question) => question.id === vote.id,
    );
    expect(after_vote?.shares?.find((share) => share.option_id === LAINE)?.share).toBe(1);
  });

  it("leaves a live pick unscored until the game decides it", async () => {
    const { service } = create_service(game({ state: "live", period: 2, ended_in: null }));
    const [next_goal] = await service.list(GAME_ID, "live", "u1");

    const result = await service.answer("u1", next_goal?.id ?? "", "home");

    expect(result).toMatchObject({ correct: null, points_awarded: null });
  });

  it("refuses a second answer, a locked question and an unknown option", async () => {
    const live = game({ state: "live", period: 2, ended_in: null });
    const { repository, service } = create_service(live);
    const [next_goal, period_goal] = await service.list(GAME_ID, "live", "u1");
    await service.answer("u1", next_goal?.id ?? "", "home");

    await expect(service.answer("u1", next_goal?.id ?? "", "away")).rejects.toMatchObject({
      code: "ALREADY_ANSWERED",
      http_status: 409,
    });
    await expect(service.answer("u2", period_goal?.id ?? "", "maybe")).rejects.toMatchObject({
      code: "INVALID_ANSWER",
    });
    const late = new QuestionsService(
      repository,
      { get_game_detail: () => Promise.resolve({ ...live, period: 3 }) },
      { list_players: () => Promise.resolve([]) },
      () => NOW,
    );
    await expect(late.answer("u2", period_goal?.id ?? "", "yes")).rejects.toMatchObject({
      code: "QUESTION_LOCKED",
      http_status: 409,
    });
    await expect(
      late.answer("u2", "00000000-0000-4000-9000-999999999999", "yes"),
    ).rejects.toMatchObject({
      code: "QUESTION_NOT_FOUND",
    });
  });
});

describe("QuestionsService.list_demo", () => {
  it("builds the replay's questions with the answers, and saves nothing", async () => {
    const { repository, service } = create_service();

    const questions = await service.list_demo(GAME_ID, "after", "final");

    expect(questions[0]?.id).toBe(`demo_${GAME_ID}_result_quiz_1`);
    expect(questions[0]?.correct_option).not.toBeNull();
    expect(questions.every((question) => question.my_answer === null)).toBe(true);
    expect(repository.rows).toEqual([]);
  });
});
