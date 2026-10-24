import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { ScoreAnswersJob, decide_questions, score_answers } from "./score_answers";
import type {
  AnswerPoints,
  LiveGameRow,
  OpenLiveQuestion,
  ScoreAnswersRepository,
  UnscoredAnswer,
} from "./score_answers_repository";
import type { GoalRow } from "./score_predictions_repository";

const GAME: LiveGameRow = {
  id: "g1",
  home_team_id: "home",
  away_team_id: "away",
  period: 3,
  status: "live",
};
const GOALS: GoalRow[] = [
  { game_id: "g1", team_id: "home", player_id: "p1", period: 1 },
  { game_id: "g1", team_id: "away", player_id: "p2", period: 2 },
];

describe("decide_questions", () => {
  it("decides next goals already scored and periods already over, and leaves the rest open", () => {
    const questions: OpenLiveQuestion[] = [
      { id: "q1", game_id: "g1", question_type: "next_goal", target: 1 },
      { id: "q2", game_id: "g1", question_type: "next_goal", target: 2 },
      { id: "q3", game_id: "g1", question_type: "period_goal", target: 2 },
      { id: "q4", game_id: "g1", question_type: "period_goal", target: 3 },
    ];
    expect(decide_questions(questions, [GAME], GOALS)).toEqual([
      { question_id: "q1", correct_option: "away" },
      { question_id: "q3", correct_option: "yes" },
    ]);
  });
});

describe("score_answers", () => {
  it("scores right and wrong answers and votes, and skips undecided ones", () => {
    const answers: UnscoredAnswer[] = [
      { id: "a1", answer: "away", question_type: "next_goal", correct_option: "away" },
      { id: "a2", answer: "yes", question_type: "period_goal", correct_option: "no" },
      { id: "a3", answer: "p1", question_type: "player_vote", correct_option: null },
      { id: "a4", answer: "home", question_type: "next_goal", correct_option: null },
    ];
    expect(score_answers(answers)).toEqual([
      { answer_id: "a1", points_awarded: 5 },
      { answer_id: "a2", points_awarded: 0 },
      { answer_id: "a3", points_awarded: 1 },
    ]);
  });
});

class FakeRepository implements ScoreAnswersRepository {
  questions: OpenLiveQuestion[] = [
    { id: "q1", game_id: "g1", question_type: "next_goal", target: 1 },
  ];
  answers: (UnscoredAnswer & { question_id: string; points_awarded: number | null })[] = [
    {
      id: "a1",
      question_id: "q1",
      answer: "away",
      question_type: "next_goal",
      correct_option: null,
      points_awarded: null,
    },
  ];

  list_open_live_questions(): Promise<OpenLiveQuestion[]> {
    return Promise.resolve(this.questions);
  }
  list_games(): Promise<LiveGameRow[]> {
    return Promise.resolve([GAME]);
  }
  list_goals(): Promise<GoalRow[]> {
    return Promise.resolve(GOALS);
  }
  close_questions(
    decided: readonly { question_id: string; correct_option: string }[],
  ): Promise<void> {
    for (const { question_id, correct_option } of decided) {
      this.questions = this.questions.filter((question) => question.id !== question_id);
      for (const answer of this.answers.filter(
        (candidate) => candidate.question_id === question_id,
      )) {
        answer.correct_option = correct_option;
      }
    }
    return Promise.resolve();
  }
  list_unscored_answers(): Promise<UnscoredAnswer[]> {
    return Promise.resolve(
      this.answers.filter(
        (answer) => answer.points_awarded === null && answer.correct_option !== null,
      ),
    );
  }
  save_points(updates: readonly AnswerPoints[]): Promise<void> {
    for (const update of updates) {
      const answer = this.answers.find((candidate) => candidate.id === update.answer_id);
      if (answer) {
        answer.points_awarded = update.points_awarded;
      }
    }
    return Promise.resolve();
  }
}

describe("ScoreAnswersJob", () => {
  it("decides and scores once; a second run changes nothing (idempotent)", async () => {
    const repository = new FakeRepository();
    const job = new ScoreAnswersJob(repository, pino({ level: "silent" }));

    expect(await job.run()).toEqual({ closed_question_count: 1, scored_answer_count: 1 });
    expect(repository.answers[0]?.points_awarded).toBe(5);
    expect(await job.run()).toEqual({ closed_question_count: 0, scored_answer_count: 0 });
    expect(repository.answers[0]?.points_awarded).toBe(5);
  });
});
