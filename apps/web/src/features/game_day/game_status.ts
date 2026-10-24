import type { GameSummary } from "@voita_kone/shared_types";
import type { StatusTone } from "../../components/status_pill";
import {
  format_clock_time,
  format_period,
  format_period_clock,
  format_score,
} from "../../lib/format";
import { game_day_copy } from "./copy";

/** Status pill text and tone for a game, as in the design. */
export function game_status(
  game: GameSummary,
  is_featured: boolean,
): { label: string; tone: StatusTone } {
  if (game.state === "live") {
    const label =
      is_featured && game.period !== null && game.game_clock_seconds !== null
        ? game_day_copy.live_at(
            format_period(game.period),
            format_period_clock(game.game_clock_seconds, game.period),
          )
        : game_day_copy.live;
    return { label, tone: "live" };
  }
  if (game.state === "final") {
    return { label: game_day_copy.final, tone: "final" };
  }
  const time = format_clock_time(game.start_time);
  return { label: is_featured ? game_day_copy.today_at(time) : time, tone: "upcoming" };
}

/** "VS" before the game, the score after puck drop. */
export function center_text(game: GameSummary): string {
  if (game.state === "upcoming" || game.home_goals === null || game.away_goals === null) {
    return game_day_copy.vs;
  }
  return format_score(
    game.home_goals,
    game.away_goals,
    game.state === "final" ? game.ended_in : null,
  );
}
