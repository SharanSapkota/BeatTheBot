import type { Fact, FactSheet, GoalFact } from "@voita_kone/fact_checker";
import {
  FACT_SHEET_END,
  FACT_SHEET_START,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
} from "./llm_client";

// Stands in for a real LLM until a provider is chosen. It reads the fact sheet from the
// prompt (the JSON block between the markers) and writes a short English story that cites
// fact ids, like a real model would, so the whole pipeline (strip ids, check claims, retry,
// traffic light) runs for real.

export const MOCK_MODEL_NAME = "mock_llm_v1";

const KIND_NAMES = {
  relegation: "chance of relegation",
  playoffs: "chance of making the playoffs",
  top_4: "chance of a top-4 finish",
} as const;

function percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

function ordinal(rank: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const teen = rank % 100 >= 11 && rank % 100 <= 13;
  return `${String(rank)}${teen ? "th" : (suffixes[rank % 10] ?? "th")}`;
}

function read_fact_sheet(prompt: string): FactSheet {
  const start = prompt.indexOf(FACT_SHEET_START);
  const end = prompt.indexOf(FACT_SHEET_END);
  if (start === -1 || end === -1) {
    throw new Error("Mock LLM: the prompt has no fact sheet");
  }
  return JSON.parse(prompt.slice(start + FACT_SHEET_START.length, end)) as FactSheet;
}

function of_type<T extends Fact["type"]>(sheet: FactSheet, type: T): Extract<Fact, { type: T }>[] {
  return sheet.facts.filter((fact): fact is Extract<Fact, { type: T }> => fact.type === type);
}

function winner_sentences(sheet: FactSheet): string[] {
  const [result] = of_type(sheet, "final_score");
  if (!result) {
    return [];
  }
  const { home_team, away_team, home_goals, away_goals, ended_in } = result.value;
  const home_won = home_goals > away_goals;
  const winner = home_won ? home_team : away_team;
  const loser = home_won ? away_team : home_team;
  const how =
    ended_in === "regulation" ? "" : ` in ${ended_in === "overtime" ? "overtime" : "a shootout"}`;
  const venue = home_won ? "at home" : "away";
  const sentences = [
    `${winner} beat ${loser} ${String(Math.max(home_goals, away_goals))}–${String(Math.min(home_goals, away_goals))} ${venue}${how}. [${result.fact_id}]`,
  ];
  const last_goal: GoalFact | undefined = of_type(sheet, "goal").at(-1);
  if (last_goal) {
    sentences.push(
      `${last_goal.value.player} scored the last goal at ${last_goal.value.game_time}. [${last_goal.fact_id}]`,
    );
  }
  return sentences;
}

function standing_sentences(sheet: FactSheet): string[] {
  return of_type(sheet, "standing")
    .filter((fact) => fact.value.rank_before !== fact.value.rank_after)
    .map(
      (fact) =>
        `The result moves ${fact.value.team} from ${ordinal(fact.value.rank_before)} to ${ordinal(fact.value.rank_after)} place. [${fact.fact_id}]`,
    );
}

/** Odds that change after rounding (a "0% to 0%" sentence says nothing). */
function odds_sentences(sheet: FactSheet): string[] {
  const changed = of_type(sheet, "season_odds").filter(
    (fact) => percent(fact.value.before) !== percent(fact.value.after),
  );
  return changed.map((fact) => {
    const { team, kind, before, after } = fact.value;
    const direction = after < before ? "fell" : "rose";
    const owner = team.endsWith("s") ? `${team}'` : `${team}'s`;
    return `${owner} ${KIND_NAMES[kind]} ${direction} from ${percent(before)} to ${percent(after)}. [${fact.fact_id}]`;
  });
}

function next_game_sentences(sheet: FactSheet): string[] {
  return of_type(sheet, "next_game")
    .slice(0, 1)
    .map(
      (fact) =>
        `Next up for ${fact.value.team}: ${fact.value.opponent} ${fact.value.venue} on ${fact.value.weekday}. [${fact.fact_id}]`,
    );
}

function write_story(request: LlmRequest): LlmResponse {
  const sheet = read_fact_sheet(request.prompt);
  const text = [
    ...winner_sentences(sheet),
    ...standing_sentences(sheet),
    ...odds_sentences(sheet),
    ...next_game_sentences(sheet),
  ].join(" ");
  return { text, model_name: MOCK_MODEL_NAME };
}

export class MockLlmClient implements LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse> {
    // Errors reject the promise, as a real client's would.
    return Promise.resolve().then(() => write_story(request));
  }
}
