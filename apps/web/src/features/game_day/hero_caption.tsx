import type { GameSummary } from "@voita_kone/shared_types";
import { CategoryTag } from "../../components/category_tag";
import { format_clock_time, format_day_label, format_percent } from "../../lib/format";
import { useDataSays } from "../game/api";
import { center_text, is_today } from "./game_status";
import { game_day_copy } from "./copy";
import { category_of } from "./game_row";
import { config_of } from "../../lib/sports";
import styles from "./hero_caption.module.css";

interface CaptionText {
  headline: string;
  text: string;
}

/** Before the game the headline is the biggest stake (numbers from the model), else the game. */
function caption_text(game: GameSummary, stake_line: CaptionText | null): CaptionText {
  const home = game.home_team.name;
  const away = game.away_team.name;
  const time = format_clock_time(game.start_time);
  if (game.state === "live") {
    return {
      headline: game_day_copy.live_headline(home, away, center_text(game)),
      text: config_of(game.sport).has_model
        ? game_day_copy.live_text
        : game_day_copy.live_text_no_data,
    };
  }
  if (game.state === "final") {
    return {
      headline: game_day_copy.final_headline(home, away, center_text(game)),
      text: game_day_copy.final_text,
    };
  }
  return (
    stake_line ?? {
      headline: is_today(game.start_time)
        ? game_day_copy.upcoming_headline(home, away, time)
        : game_day_copy.upcoming_headline_day(home, away, format_day_label(game.start_time), time),
      text: game_day_copy.upcoming_text(time),
    }
  );
}

/** Hockey only: the model's stakes ("Data says"). */
function useStakeLine(game: GameSummary): CaptionText | null {
  const has_model = config_of(game.sport).has_model;
  const stake = useDataSays(has_model ? game : undefined).data?.stakes[0];
  if (!stake) {
    return null;
  }
  const team = stake.team_id === game.home_team.id ? game.home_team : game.away_team;
  return {
    headline: game_day_copy.stakes_headline(
      game.home_team.name,
      game.away_team.name,
      team.name,
      game_day_copy.stake_noun[stake.kind],
      format_percent(stake.if_win),
    ),
    text: game_day_copy.stakes_text(
      format_percent(stake.if_loss),
      format_clock_time(game.start_time),
    ),
  };
}

/** Desktop only: the gray caption box under the hero, like kaleva.fi's big story. */
export function HeroCaption({ game }: { game: GameSummary }) {
  const caption = caption_text(game, useStakeLine(game));
  return (
    <div className={styles.caption}>
      <CategoryTag text={category_of(game)} />
      <h2 className={styles.headline}>{caption.headline}</h2>
      <p className={styles.text}>{caption.text}</p>
    </div>
  );
}
