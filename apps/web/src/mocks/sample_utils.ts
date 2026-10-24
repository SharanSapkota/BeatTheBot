import type { GameDetail, GameEvent, GameSummary } from "@voita_kone/shared_types";

// Helpers for sample data. Sample values must look believable but are never presented as
// facts: every screen that shows them says "Concept demo · sample data".

/** The game the design was drawn for. Its sample texts and numbers match the design exactly. */
export function is_design_demo(game: GameSummary): boolean {
  return game.home_team.name === "Kärpät" && game.away_team.name === "Ilves";
}

/** A stable number in [0, 1) from a string, so sample values don't change between renders. */
export function seeded_fraction(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function round_to(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function goals_of(game: GameDetail): GameEvent[] {
  return game.events.filter((event) => event.event_type === "goal" && event.period < 5);
}

export function full_name(event: GameEvent): string | null {
  return event.player ? `${event.player.first_name} ${event.player.last_name}` : null;
}

export function team_name_of(game: GameSummary, team_id: string | null): string {
  return team_id === game.home_team.id ? game.home_team.name : game.away_team.name;
}

/** Unique scorer names in time order. */
export function scorer_names(game: GameDetail): string[] {
  const names = goals_of(game)
    .map(full_name)
    .filter((name): name is string => name !== null);
  return [...new Set(names)];
}

/** Sample "checked at" times are placed relative to puck drop, like the design (18:30 -> 21:47). */
export function minutes_after_start(game: GameSummary, minutes: number): string {
  return new Date(new Date(game.start_time).getTime() + minutes * 60_000).toISOString();
}
