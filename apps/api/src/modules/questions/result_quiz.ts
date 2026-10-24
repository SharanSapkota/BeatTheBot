import type {
  Fact,
  FactSheet,
  FinalScoreFact,
  GoalFact,
  SeasonOddsFact,
  StakeKind,
  StandingFact,
} from "@voita_kone/fact_checker";
import type { QuestionOption } from "@voita_kone/shared_types";

// The result quiz: up to 3 questions built by code from the game's fact sheet (the same facts as
// the "what it means" story). The right answer is a fact; the wrong options are plausible
// (other scorers, the odds before the game, nearby table places). Pure and deterministic.

export const QUIZ_QUESTION_COUNT = 3;
const OPTION_COUNT = 4;
const OPTION_IDS = ["a", "b", "c", "d"] as const;

export interface QuizDraft {
  /** "result_quiz:1" … */
  key: string;
  prompt: string;
  options: QuestionOption[];
  correct_option: string;
  explanation: { right: string; wrong: string };
  fact_ids: string[];
}

export interface QuizInput {
  sheet: FactSheet;
  /** Real players of both teams, best scorers first: wrong options for "who scored". */
  roster_names: readonly string[];
  /** Teams in the league: table places run from 1 to this. */
  team_count: number;
}

interface QuizCandidate {
  prompt: string;
  correct: string;
  wrong: string[];
  /** The fact as a sentence, used for both the right and the wrong feedback. */
  fact_text: string;
  fact_ids: string[];
}

const STAKE_PHRASES: Record<StakeKind, string> = {
  relegation: "chance of relegation",
  playoffs: "chance of making the playoffs",
  top_4: "chance of a top-4 finish",
};

function percent(probability: number): string {
  return `${String(Math.round(probability * 100))}%`;
}

function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) {
    return `${String(rank)}th`;
  }
  const suffix = ["th", "st", "nd", "rd"][rank % 10] ?? "th";
  return `${String(rank)}${suffix}`;
}

function score_text(home: number, away: number): string {
  return `${String(home)}–${String(away)}`;
}

/** Small string hash, so the option order is the same on every run. */
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) {
    value = Math.imul(value ^ (char.codePointAt(0) ?? 0), 16777619) >>> 0;
  }
  return value;
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  let state = hash(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0;
    const other = state % (index + 1);
    const current = result[index];
    const swap = result[other];
    if (current !== undefined && swap !== undefined) {
      result[index] = swap;
      result[other] = current;
    }
  }
  return result;
}

function distinct_wrong(correct: string, candidates: readonly string[]): string[] {
  return [...new Set(candidates)].filter((label) => label !== correct).slice(0, OPTION_COUNT - 1);
}

function first_of<T extends Fact["type"]>(sheet: FactSheet, type: T) {
  return sheet.facts.filter((fact): fact is Extract<Fact, { type: T }> => fact.type === type);
}

function first_scorer_question(
  sheet: FactSheet,
  roster_names: readonly string[],
): QuizCandidate | undefined {
  const goals: GoalFact[] = first_of(sheet, "goal");
  const first = goals[0];
  if (!first) {
    return undefined;
  }
  const { player, team, period, game_time } = first.value;
  return {
    prompt: "Who scored the first goal of the game?",
    correct: player,
    wrong: distinct_wrong(player, [...goals.map((goal) => goal.value.player), ...roster_names]),
    fact_text: `${player} scored first for ${team} at ${game_time} in the ${ordinal(period)} period.`,
    fact_ids: [first.fact_id],
  };
}

function season_odds_question(sheet: FactSheet): QuizCandidate | undefined {
  const odds: SeasonOddsFact[] = first_of(sheet, "season_odds");
  const fact = [...odds].sort(
    (first, second) =>
      Math.abs(second.value.after - second.value.before) -
      Math.abs(first.value.after - first.value.before),
  )[0];
  if (!fact) {
    return undefined;
  }
  const { team, kind, before, after } = fact.value;
  const correct = percent(after);
  const nearby = [0.1, -0.1, 0.2, -0.2, 0.3]
    .map((change) => after + change)
    .filter((probability) => probability > 0 && probability < 1)
    .map(percent);
  return {
    prompt: `After this game, what is ${team}'s ${STAKE_PHRASES[kind]}?`,
    correct,
    wrong: distinct_wrong(correct, [percent(before), ...nearby]),
    fact_text: `${team}'s ${STAKE_PHRASES[kind]} is now ${correct}. It was ${percent(before)} before the game.`,
    fact_ids: [fact.fact_id],
  };
}

function standing_question(sheet: FactSheet, team_count: number): QuizCandidate | undefined {
  const standings: StandingFact[] = first_of(sheet, "standing");
  const fact =
    standings.find((candidate) => candidate.value.rank_after !== candidate.value.rank_before) ??
    standings[0];
  if (!fact) {
    return undefined;
  }
  const { team, rank_before, rank_after, points_after } = fact.value;
  const nearby = [1, -1, 2, -2, 3, -3]
    .map((change) => rank_after + change)
    .filter((rank) => rank >= 1 && rank <= team_count);
  const correct = ordinal(rank_after);
  return {
    prompt: `Where is ${team} in the table after this game?`,
    correct,
    wrong: distinct_wrong(correct, [ordinal(rank_before), ...nearby.map(ordinal)]),
    fact_text: `${team} are ${correct} with ${String(points_after)} points.`,
    fact_ids: [fact.fact_id],
  };
}

function final_score_question(final: FinalScoreFact): QuizCandidate {
  const { home_team, away_team, home_goals, away_goals, ended_in } = final.value;
  const correct = score_text(home_goals, away_goals);
  const candidates: [number, number][] = [
    [away_goals, home_goals],
    [home_goals + 1, away_goals],
    [home_goals, away_goals + 1],
    [Math.max(0, home_goals - 1), away_goals],
    [home_goals, Math.max(0, away_goals - 1)],
    [home_goals + 1, away_goals + 1],
    [home_goals + 2, away_goals],
    [home_goals, away_goals + 2],
  ];
  const extra = ended_in === "regulation" ? "" : ` after ${ended_in}`;
  return {
    prompt: `What was the final score of ${home_team} vs ${away_team}?`,
    correct,
    wrong: distinct_wrong(
      correct,
      candidates
        .filter(([home, away]) => home !== away)
        .map(([home, away]) => score_text(home, away)),
    ),
    fact_text: `The game ended ${home_team} ${correct} ${away_team}${extra}.`,
    fact_ids: [final.fact_id],
  };
}

function to_draft(candidate: QuizCandidate, number: number, game_id: string): QuizDraft {
  const key = `result_quiz:${String(number)}`;
  const labels = shuffled([candidate.correct, ...candidate.wrong], `${game_id}:${key}`);
  const options = labels.map((label, index) => ({ id: OPTION_IDS[index] ?? String(index), label }));
  const correct_option = options.find((option) => option.label === candidate.correct)?.id ?? "a";
  return {
    key,
    prompt: candidate.prompt,
    options,
    correct_option,
    explanation: {
      right: `Correct! ${candidate.fact_text}`,
      wrong: `Not this time. ${candidate.fact_text}`,
    },
    fact_ids: candidate.fact_ids,
  };
}

/** Up to 3 questions; a question without enough plausible wrong options is skipped. */
export function build_result_quiz({ sheet, roster_names, team_count }: QuizInput): QuizDraft[] {
  const final = first_of(sheet, "final_score")[0];
  const candidates = [
    first_scorer_question(sheet, roster_names),
    season_odds_question(sheet),
    standing_question(sheet, team_count),
    final ? final_score_question(final) : undefined,
  ].filter(
    (candidate): candidate is QuizCandidate =>
      candidate !== undefined && candidate.wrong.length === OPTION_COUNT - 1,
  );
  return candidates
    .slice(0, QUIZ_QUESTION_COUNT)
    .map((candidate, index) => to_draft(candidate, index + 1, sheet.game_id));
}

export interface CheckableQuestion {
  prompt: string;
  options: readonly QuestionOption[];
  correct_option: string | null;
  explanation: { right: string; wrong: string } | null;
}

/** The texts the fact checker must pass before the question goes live. */
export function checked_texts(draft: CheckableQuestion): string[] {
  const correct = draft.options.find((option) => option.id === draft.correct_option);
  return [
    draft.prompt,
    correct?.label ?? "",
    draft.explanation?.right ?? "",
    draft.explanation?.wrong ?? "",
  ];
}
