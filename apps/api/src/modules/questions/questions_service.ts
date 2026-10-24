import {
  build_fact_sheet,
  check_claims,
  type FactSheet,
  type KnownName,
} from "@voita_kone/fact_checker";
import { season_config } from "@voita_kone/prediction_model";
import { score_answer, type QuestionType } from "@voita_kone/scoring";
import type {
  AnswerResult,
  GameDetail,
  PlayerSummary,
  Question,
  QuestionPhase,
  ReplayMoment,
} from "@voita_kone/shared_types";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { to_helsinki_date } from "../../common/helsinki_date";
import {
  build_after_drafts,
  build_live_drafts,
  current_correct_option,
  is_question_locked,
  type QuestionDraft,
} from "./question_drafts";
import type {
  AnswerCount,
  AnswerRow,
  QuestionRow,
  QuestionsRepository,
} from "./questions_repository";
import { build_result_quiz, checked_texts, type CheckableQuestion } from "./result_quiz";

export interface GameSource {
  get_game_detail(game_id: string): Promise<GameDetail>;
}

export interface PlayerSource {
  list_players(team_id: string): Promise<PlayerSummary[]>;
}

export interface DemoGameSource {
  get_game_detail(game_id: string, moment: ReplayMoment): Promise<GameDetail>;
}

const SHOOTOUT_PERIOD = 5;
/** The order on the screens: live picks, poll, then quiz and vote. */
const TYPE_ORDER: readonly QuestionType[] = [
  "next_goal",
  "period_goal",
  "poll",
  "result_quiz",
  "player_vote",
];

function by_screen_order(first: QuestionRow, second: QuestionRow): number {
  return (
    TYPE_ORDER.indexOf(first.question_type) - TYPE_ORDER.indexOf(second.question_type) ||
    (first.target ?? 0) - (second.target ?? 0) ||
    first.question_key.localeCompare(second.question_key)
  );
}

export function question_not_found(question_id: string): AppError {
  return new AppError("QUESTION_NOT_FOUND", 404, `Question ${question_id} not found`);
}

function full_name(player: { first_name: string; last_name: string }): string {
  return `${player.first_name} ${player.last_name}`;
}

/** The game's facts when no story has saved a fact sheet yet: the score and the goals. */
export function basic_fact_sheet(game: GameDetail, now: Date): FactSheet {
  return build_fact_sheet({
    game_id: game.id,
    built_at: now.toISOString(),
    date: to_helsinki_date(new Date(game.start_time)),
    home_team: game.home_team.name,
    away_team: game.away_team.name,
    home_goals: game.home_goals ?? 0,
    away_goals: game.away_goals ?? 0,
    ended_in: game.ended_in ?? "regulation",
    goals: game.events
      .filter((event) => event.event_type === "goal" && event.period < SHOOTOUT_PERIOD)
      .map((event) => ({
        player: event.player ? full_name(event.player) : null,
        team: event.team_id === game.home_team.id ? game.home_team.name : game.away_team.name,
        period: event.period,
        game_time_seconds: event.game_time_seconds,
      })),
    standings: [],
    odds: [],
    odds_source: "derived",
    next_games: [],
  });
}

function known_names_of(game: GameDetail, players: readonly PlayerSummary[]): KnownName[] {
  return [
    { name: game.home_team.name, kind: "team" },
    { name: game.away_team.name, kind: "team" },
    ...players.map((player) => ({ name: full_name(player), kind: "player" as const })),
  ];
}

/** Every quiz text must pass the fact checker; a question that fails waits for an editor. */
export function passes_fact_check(
  draft: CheckableQuestion,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): boolean {
  if (draft.correct_option === null || draft.explanation === null) {
    return false;
  }
  return checked_texts(draft).every((text) => check_claims(text, sheet, known_names).passed);
}

function shares_of(
  question: { id: string; options: readonly { id: string }[] },
  counts: readonly AnswerCount[],
) {
  const mine = counts.filter((count) => count.question_id === question.id);
  const total = mine.reduce((sum, count) => sum + count.count, 0);
  if (total === 0) {
    return null;
  }
  return question.options.map((option) => ({
    option_id: option.id,
    share: (mine.find((count) => count.answer === option.id)?.count ?? 0) / total,
  }));
}

/**
 * Live picks (next goal, goal in the 3rd period, fan poll), the result quiz and the player
 * vote. Real games: questions are created when first asked for and answers are saved and
 * scored. Demo replays: the same questions for the replay moment, nothing is saved.
 */
export class QuestionsService {
  constructor(
    private readonly repository: QuestionsRepository,
    private readonly games: GameSource,
    private readonly players: PlayerSource,
    private readonly clock: Clock,
    private readonly demo_games?: DemoGameSource,
  ) {}

  async list(game_id: string, phase: QuestionPhase, user_id: string | null): Promise<Question[]> {
    const game = await this.games.get_game_detail(game_id);
    const now = this.clock();
    const { drafts, sheet, known_names } = await this.build_drafts(game, phase, now);
    await this.repository.insert_questions(
      game_id,
      drafts.map((draft) => ({
        draft,
        status:
          draft.question_type === "result_quiz" &&
          sheet &&
          !passes_fact_check(draft, sheet, known_names)
            ? "in_review"
            : "live",
      })),
    );
    const rows = (await this.repository.list_questions(game_id, phase)).sort(by_screen_order);
    const ids = rows.map((row) => row.id);
    const [answers, counts] = await Promise.all([
      user_id ? this.repository.list_answers(user_id, ids) : Promise.resolve([]),
      this.repository.count_answers(ids),
    ]);
    return rows.map((row) =>
      to_question(
        row,
        game,
        now,
        answers.find((answer) => answer.question_id === row.id),
        counts,
      ),
    );
  }

  async answer(user_id: string, question_id: string, answer: string): Promise<AnswerResult> {
    const question = await this.repository.find_question(question_id);
    if (!question) {
      throw question_not_found(question_id);
    }
    const game = await this.games.get_game_detail(question.game_id);
    if (is_question_locked(question, game, this.clock())) {
      throw new AppError("QUESTION_LOCKED", 409, `Question ${question_id} is locked`);
    }
    if (!question.options.some((option) => option.id === answer)) {
      throw new AppError("INVALID_ANSWER", 400, "The answer must be one of the options");
    }
    const correct_option = current_correct_option(question, game);
    const points_awarded = score_answer({ ...question, correct_option }, answer);
    const inserted = await this.repository.insert_answer(
      user_id,
      question_id,
      answer,
      points_awarded,
    );
    if (!inserted) {
      throw new AppError("ALREADY_ANSWERED", 409, `You already answered question ${question_id}`);
    }
    const correct = correct_option === null ? null : answer === correct_option;
    return {
      question_id,
      answer,
      correct:
        question.question_type === "player_vote" || question.question_type === "poll"
          ? null
          : correct,
      points_awarded,
      correct_option,
      explanation:
        question.explanation && correct !== null
          ? correct
            ? question.explanation.right
            : question.explanation.wrong
          : null,
    };
  }

  /** Demo replay: the questions at the replay moment. Never saved, never on the leaderboard. */
  async list_demo(
    game_id: string,
    phase: QuestionPhase,
    moment: ReplayMoment,
  ): Promise<Question[]> {
    if (!this.demo_games) {
      throw new AppError("NOT_FOUND", 404, "Demo replay is off");
    }
    const game = await this.demo_games.get_game_detail(game_id, moment);
    const now = this.clock();
    const { drafts, sheet, known_names } = await this.build_drafts(game, phase, now);
    return drafts
      .filter(
        (draft) =>
          draft.question_type !== "result_quiz" ||
          !sheet ||
          passes_fact_check(draft, sheet, known_names),
      )
      .map((draft) => to_demo_question(draft, game, now));
  }

  private async build_drafts(game: GameDetail, phase: QuestionPhase, now: Date) {
    const players = await this.team_players(game);
    if (phase === "live") {
      return { drafts: build_live_drafts(game, players, now), sheet: undefined, known_names: [] };
    }
    if (game.state !== "final") {
      return { drafts: [], sheet: undefined, known_names: [] };
    }
    const facts = await this.repository.find_latest_facts(game.id);
    const sheet: FactSheet = facts
      ? { game_id: game.id, built_at: now.toISOString(), facts }
      : basic_fact_sheet(game, now);
    const quiz = build_result_quiz({
      sheet,
      roster_names: players.map(full_name),
      team_count: season_config.team_count,
    });
    return {
      drafts: build_after_drafts(game, players, quiz, now),
      sheet,
      known_names: known_names_of(game, players),
    };
  }

  private async team_players(game: GameDetail): Promise<PlayerSummary[]> {
    const [home, away] = await Promise.all([
      this.players.list_players(game.home_team.id),
      this.players.list_players(game.away_team.id),
    ]);
    return [...home, ...away];
  }
}

function to_question(
  row: QuestionRow,
  game: GameDetail,
  now: Date,
  answer: AnswerRow | undefined,
  counts: readonly AnswerCount[],
): Question {
  const is_locked = is_question_locked(row, game, now);
  const correct_option = current_correct_option(row, game);
  // The right answer is shown once decided, to those who answered or when nobody can answer.
  const reveal = correct_option !== null && (answer !== undefined || is_locked);
  const has_shares = row.question_type === "poll" || row.question_type === "player_vote";
  return {
    id: row.id,
    game_id: row.game_id,
    phase: row.phase,
    question_type: row.question_type,
    prompt: row.prompt,
    options: row.options,
    points: row.points,
    target: row.target,
    opens_at: row.opens_at.toISOString(),
    locks_at: row.locks_at.toISOString(),
    is_locked,
    correct_option: reveal ? correct_option : null,
    explanation: reveal ? row.explanation : null,
    my_answer: answer
      ? {
          answer: answer.answer,
          // Scored by the job; until then the same rules give the points as soon as decided.
          points_awarded:
            answer.points_awarded ?? score_answer({ ...row, correct_option }, answer.answer),
        }
      : null,
    shares: has_shares && (answer !== undefined || is_locked) ? shares_of(row, counts) : null,
  };
}

function to_demo_question(draft: QuestionDraft, game: GameDetail, now: Date): Question {
  const correct_option = current_correct_option(draft, game);
  return {
    id: `demo_${game.id}_${draft.key.replace(":", "_")}`,
    game_id: game.id,
    phase: draft.phase,
    question_type: draft.question_type,
    prompt: draft.prompt,
    options: draft.options,
    points: draft.points,
    target: draft.target,
    opens_at: draft.opens_at.toISOString(),
    locks_at: draft.locks_at.toISOString(),
    is_locked: is_question_locked(draft, game, now),
    // A replay of a game that is already over: answers are checked on the device.
    correct_option,
    explanation: draft.explanation,
    my_answer: null,
    shares: null,
  };
}
