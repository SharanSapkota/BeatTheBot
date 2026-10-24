import type { FactSheet, SeasonOddsFact } from "@voita_kone/fact_checker";

// The headline is a fixed template from the fact sheet (numbers from code), not LLM text.

const KIND_NAMES = {
  relegation: "relegation risk",
  playoffs: "playoff chance",
  top_4: "top-4 chance",
} as const;

/** "Kärpät's", but "Pelicans'" and "Ilves'" (names ending in s). */
export function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function percent(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

/** "Kärpät's relegation risk drops to 27%", or the score when no odds changed. */
export function build_headline(sheet: FactSheet): string {
  const odds = sheet.facts.filter((fact): fact is SeasonOddsFact => fact.type === "season_odds");
  const biggest = [...odds].sort(
    (first, second) =>
      Math.abs(second.value.after - second.value.before) -
      Math.abs(first.value.after - first.value.before),
  )[0];
  if (biggest && Math.round(biggest.value.after * 100) !== Math.round(biggest.value.before * 100)) {
    const { team, kind, before, after } = biggest.value;
    const verb = after < before ? "drops" : "rises";
    return `${possessive(team)} ${KIND_NAMES[kind]} ${verb} to ${percent(after)}`;
  }
  const result = sheet.facts.find((fact) => fact.type === "final_score");
  if (!result) {
    return "";
  }
  const { home_team, away_team, home_goals, away_goals } = result.value;
  return `${home_team} ${String(home_goals)}–${String(away_goals)} ${away_team}`;
}
