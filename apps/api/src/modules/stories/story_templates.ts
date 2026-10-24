import type { Fact, FactSheet, StakeKind } from "@voita_kone/fact_checker";
import { possessive } from "./story_headline";

// The automatic texts when no LLM is available: fixed sentences filled from the same fact sheet
// (numbers from code). They go through the fact checker like any AI text.

const KIND_NAMES: Record<StakeKind, string> = {
  relegation: "chance of relegation",
  playoffs: "chance of making the playoffs",
  top_4: "chance of a top-4 finish",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function facts_of<T extends Fact["type"]>(sheet: FactSheet, type: T): Extract<Fact, { type: T }>[] {
  return sheet.facts.filter((fact): fact is Extract<Fact, { type: T }> => fact.type === type);
}

function percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

export function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) {
    return `${String(rank)}th`;
  }
  return `${String(rank)}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
}

/** "2026-02-01" → "1 Feb". */
export function short_date(date: string): string {
  const [, month = "1", day = "1"] = date.split("-");
  return `${String(Number(day))} ${MONTHS[Number(month) - 1] ?? ""}`;
}

/** Both teams' form in one sentence, and the player in form. */
function form_bullet(sheet: FactSheet): string | null {
  const [first, second] = facts_of(sheet, "form").map((fact) => fact.value);
  const sentences: string[] = [];
  if (first && second) {
    sentences.push(
      `${first.team} won ${String(first.wins)} of their last ${String(first.games)} games, ${second.team} ${String(second.wins)} of ${String(second.games)}.`,
    );
  } else if (first) {
    sentences.push(
      `${first.team} won ${String(first.wins)} of their last ${String(first.games)} games.`,
    );
  }
  const scorer = facts_of(sheet, "player_form")[0];
  if (scorer) {
    const { player, team, goals, games } = scorer.value;
    sentences.push(
      `In form: ${possessive(team)} ${player} has ${String(goals)} goals in the last ${String(games)} games.`,
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

function history_bullet(sheet: FactSheet): string | null {
  const last = facts_of(sheet, "head_to_head")[0];
  if (!last) {
    return null;
  }
  const { home_team, away_team, home_goals, away_goals, date } = last.value;
  return `They last met on ${short_date(date)}: ${home_team} ${String(home_goals)}–${String(away_goals)} ${away_team}.`;
}

function stakes_bullet(sheet: FactSheet): string | null {
  const sentences: string[] = [];
  const chance = facts_of(sheet, "win_chance")[0];
  if (chance) {
    const { home_team, away_team, home_win, away_win } = chance.value;
    sentences.push(
      `Data says ${home_team} have a ${percent(home_win)} chance of winning and ${away_team} ${percent(away_win)}.`,
    );
  }
  for (const { value } of facts_of(sheet, "stake")) {
    sentences.push(
      `A win would put ${possessive(value.team)} ${KIND_NAMES[value.kind]} at ${percent(value.if_win)}, a loss at ${percent(value.if_loss)}.`,
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

/** Up to 3 bullets ("- …"): form, history, what is at stake. */
export function template_preview(sheet: FactSheet): string {
  return [form_bullet(sheet), history_bullet(sheet), stakes_bullet(sheet)]
    .filter((bullet): bullet is string => bullet !== null)
    .map((bullet) => `- ${bullet}`)
    .join("\n");
}

function result_sentence(sheet: FactSheet): string | null {
  const result = facts_of(sheet, "final_score")[0];
  if (!result) {
    return null;
  }
  const { home_team, away_team, home_goals, away_goals, ended_in } = result.value;
  const how =
    ended_in === "overtime" ? " after overtime" : ended_in === "shootout" ? " in a shootout" : "";
  return home_goals > away_goals
    ? `${home_team} beat ${away_team} ${String(home_goals)}–${String(away_goals)}${how}.`
    : `${away_team} won ${String(away_goals)}–${String(home_goals)} away at ${home_team}${how}.`;
}

export function template_summary(sheet: FactSheet): string {
  const sentences = [result_sentence(sheet)];
  const scorers = [...new Set(facts_of(sheet, "goal").map((fact) => fact.value.player))];
  if (scorers.length > 0) {
    sentences.push(`Scorers: ${scorers.join(", ")}.`);
  }
  const winner = facts_of(sheet, "winning_goal")[0];
  if (winner) {
    sentences.push(`${winner.value.player} scored the winning goal at ${winner.value.game_time}.`);
  }
  for (const { value } of facts_of(sheet, "standing")) {
    sentences.push(
      value.rank_after === value.rank_before
        ? `${value.team} stay ${ordinal(value.rank_after)} with ${String(value.points_after)} points.`
        : `${value.team} move from ${ordinal(value.rank_before)} to ${ordinal(value.rank_after)} with ${String(value.points_after)} points.`,
    );
  }
  for (const { value } of facts_of(sheet, "season_odds")) {
    if (Math.round(value.before * 100) !== Math.round(value.after * 100)) {
      sentences.push(
        `${possessive(value.team)} ${KIND_NAMES[value.kind]} went from ${percent(value.before)} to ${percent(value.after)}.`,
      );
    }
  }
  const next = facts_of(sheet, "next_game")[0];
  if (next) {
    const { team, opponent, venue, weekday } = next.value;
    sentences.push(
      `Next, ${team} play ${opponent} ${venue === "home" ? "at home" : "away"} on ${weekday}.`,
    );
  }
  return sentences.filter((sentence): sentence is string => sentence !== null).join(" ");
}
