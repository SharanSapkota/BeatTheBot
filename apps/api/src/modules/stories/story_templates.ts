import type { Fact, FactSheet, StakeKind } from "@voita_kone/fact_checker";
import { possessive } from "./story_headline";

// The automatic texts when no LLM is available: fixed sentences filled from the same fact sheet
// (numbers from code). They go through the fact checker like any AI text.

const KIND_NAMES: Record<StakeKind, string> = {
  relegation: "chance of relegation",
  playoffs: "chance of making the playoffs",
  top_4: "chance of a top-4 finish",
};
/** The preview's last line starts with this. */
export const WHY_IT_MATTERS = "Why it matters:";
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

/** "won 3 of their last 5 games" (draws: "won 2 and drew 1 of …"; one game: "won their last game"). */
function record_text(value: { wins: number; draws: number; games: number }): string {
  if (value.games === 1) {
    return value.wins === 1
      ? "won their last game"
      : value.draws === 1
        ? "drew their last game"
        : "lost their last game";
  }
  return value.draws > 0
    ? `won ${String(value.wins)} and drew ${String(value.draws)} of their last ${String(value.games)} games`
    : `won ${String(value.wins)} of their last ${String(value.games)} games`;
}

/** Both teams' form in one sentence, and the player in form. */
function form_bullet(sheet: FactSheet): string | null {
  const [first, second] = facts_of(sheet, "form").map((fact) => fact.value);
  const sentences: string[] = [];
  if (first && second) {
    const second_text =
      second.games === 1
        ? record_text(second)
        : second.draws > 0
          ? `won ${String(second.wins)} and drew ${String(second.draws)} of ${String(second.games)}`
          : `${String(second.wins)} of ${String(second.games)}`;
    sentences.push(`${first.team} ${record_text(first)}, ${second.team} ${second_text}.`);
  } else if (first) {
    sentences.push(`${first.team} ${record_text(first)}.`);
  }
  const scorer = facts_of(sheet, "player_form")[0];
  if (scorer) {
    const { player, team, goals, games } = scorer.value;
    sentences.push(
      `In form: ${possessive(team)} ${player} has ${String(goals)} ${goals === 1 ? "goal" : "goals"} in the last ${String(games)} games.`,
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

function history_bullet(sheet: FactSheet): string | null {
  const sentences: string[] = [];
  const last = facts_of(sheet, "head_to_head")[0];
  if (last) {
    const { home_team, away_team, home_goals, away_goals, date } = last.value;
    sentences.push(
      `They last met on ${short_date(date)}: ${home_team} ${String(home_goals)}–${String(away_goals)} ${away_team}.`,
    );
  }
  const series = facts_of(sheet, "season_series")[0];
  if (series) {
    const { home_team, away_team, home_team_wins, away_team_wins, draws } = series.value;
    const draw_text = draws > 0 ? ` with ${String(draws)} ${draws === 1 ? "draw" : "draws"}` : "";
    sentences.push(
      `This season: ${home_team} ${String(home_team_wins)}, ${away_team} ${String(away_team_wins)}${draw_text}.`,
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

/** "Data says" (hockey) and the table positions. */
function data_bullet(sheet: FactSheet): string | null {
  const sentences: string[] = [];
  const chance = facts_of(sheet, "win_chance")[0];
  if (chance) {
    const { home_team, away_team, home_win, away_win } = chance.value;
    sentences.push(
      `Data says ${home_team} have a ${percent(home_win)} chance of winning and ${away_team} ${percent(away_win)}.`,
    );
  }
  const tables = facts_of(sheet, "table_position").map(({ value }) => value);
  if (tables.length > 0) {
    sentences.push(
      `In the table: ${tables
        .map((table) => `${table.team} ${ordinal(table.rank)} with ${String(table.points)} points`)
        .join(", ")}.`,
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}

/** What is at stake (hockey: the model's stake), else how close the teams are in the table. */
function why_it_matters(sheet: FactSheet): string | null {
  const stake = facts_of(sheet, "stake")[0];
  if (stake) {
    const { team, kind, if_win, if_loss } = stake.value;
    return `A win would put ${possessive(team)} ${KIND_NAMES[kind]} at ${percent(if_win)}, a loss at ${percent(if_loss)}.`;
  }
  const [first, second] = facts_of(sheet, "table_position").map(({ value }) => value);
  if (first && second) {
    const gap = Math.abs(first.points - second.points);
    return gap === 0
      ? `${first.team} and ${second.team} are level on ${String(first.points)} points.`
      : `${String(gap)} ${gap === 1 ? "point separates" : "points separate"} ${first.team} and ${second.team} in the table.`;
  }
  return null;
}

/** Up to 3 bullets ("- …"): form, history, data; then "Why it matters: …". */
export function template_preview(sheet: FactSheet): string {
  const bullets = [form_bullet(sheet), history_bullet(sheet), data_bullet(sheet)]
    .filter((bullet): bullet is string => bullet !== null)
    .map((bullet) => `- ${bullet}`);
  const why = why_it_matters(sheet);
  return [...bullets, ...(why ? [`${WHY_IT_MATTERS} ${why}`] : [])].join("\n");
}

function result_sentence(sheet: FactSheet): string | null {
  const result = facts_of(sheet, "final_score")[0];
  if (!result) {
    return null;
  }
  const { home_team, away_team, home_goals, away_goals, ended_in } = result.value;
  const how =
    ended_in === "overtime" ? " after overtime" : ended_in === "shootout" ? " in a shootout" : "";
  if (home_goals === away_goals) {
    return `${home_team} and ${away_team} drew ${String(home_goals)}–${String(away_goals)}.`;
  }
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
  const lead = facts_of(sheet, "lead_changes")[0];
  if (lead?.value.comeback) {
    const { team, from_behind } = lead.value.comeback;
    sentences.push(
      `${team} came back from ${String(from_behind)} ${from_behind === 1 ? "goal" : "goals"} down.`,
    );
  } else if (lead && lead.value.lead_changes > 0) {
    const changes = lead.value.lead_changes;
    sentences.push(
      `The lead changed hands ${String(changes)} ${changes === 1 ? "time" : "times"}.`,
    );
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
