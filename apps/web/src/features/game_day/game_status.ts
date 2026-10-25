import type { GameSummary } from "@voita_kone/shared_types";
import type { StatusTone } from "../../components/status_pill";
import {
  format_clock_time,
  format_day_label,
  helsinki_date_of,
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
            format_period(game.period, game.sport),
            format_period_clock(game.game_clock_seconds, game.period, game.sport),
          )
        : game_day_copy.live;
    return { label, tone: "live" };
  }
  if (game.state === "final") {
    return { label: game_day_copy.final, tone: "final" };
  }
  const time = format_clock_time(game.start_time);
  if (!is_featured) {
    return { label: time, tone: "upcoming" };
  }
  return {
    label: is_today(game.start_time)
      ? game_day_copy.today_at(time)
      : game_day_copy.day_at(format_day_label(game.start_time), time),
    tone: "upcoming",
  };
}

/** True when the instant is on today's Helsinki calendar day. */
export function is_today(instant: string): boolean {
  return helsinki_date_of(instant) === helsinki_date_of(new Date());
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
