import type { GameDetail, Highlight } from "@voita_kone/shared_types";
import { format_game_time, format_score } from "../lib/format";
import { full_name, goals_of, is_design_demo, minutes_after_start } from "./sample_utils";

// Sample highlight for the After screen (until step 7). The design's Kärpät 3-1 Ilves texts are used as is;
// other games get texts built only from their real result and goal events.

function winner_and_loser(game: GameDetail) {
  const home_won = (game.home_goals ?? 0) > (game.away_goals ?? 0);
  return home_won
    ? { winner: game.home_team, loser: game.away_team }
    : { winner: game.away_team, loser: game.home_team };
}

function score_text(game: GameDetail): string {
  return format_score(game.home_goals ?? 0, game.away_goals ?? 0).replaceAll(" ", "");
}

// TODO(step 7): replace with GET /api/v1/games/:game_id/highlight (chosen by an editor).
export function build_sample_highlight(game: GameDetail): Highlight | null {
  if (is_design_demo(game)) {
    return {
      title: "Laine's wrist shot seals it at 51:03",
      caption:
        "Eetu Laine scores his second goal of the night to make it 3–1 and end the Ilves comeback.",
      video_url: null,
      duration_seconds: 42,
      clip_credit: "[rights holder]",
      published_at: minutes_after_start(game, 202),
    };
  }
  const { winner } = winner_and_loser(game);
  const last_winner_goal = goals_of(game)
    .filter((goal) => goal.team_id === winner.id && goal.player)
    .at(-1);
  if (!last_winner_goal?.player) {
    return null;
  }
  return {
    title: `${last_winner_goal.player.last_name}'s goal for ${winner.name} at ${format_game_time(last_winner_goal.game_time_seconds)}`,
    caption: `${full_name(last_winner_goal) ?? ""} scores for ${winner.name}, who win ${score_text(game)}.`,
    video_url: null,
    duration_seconds: 42,
    clip_credit: "[rights holder]",
    published_at: minutes_after_start(game, 202),
  };
}
