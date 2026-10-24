import type { GameSummary } from "@voita_kone/shared_types";
import { CategoryTag } from "../../components/category_tag";
import { format_clock_time, format_percent } from "../../lib/format";
import { useAiPrediction } from "../game/api";
import { center_text } from "./game_status";
import { game_day_copy } from "./copy";
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
      text: game_day_copy.live_text,
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
      headline: game_day_copy.upcoming_headline(home, away, time),
      text: game_day_copy.upcoming_text(time),
    }
  );
}

function useStakeLine(game: GameSummary): CaptionText | null {
  const prediction = useAiPrediction(game).data;
  const stake = prediction?.stakes[0];
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
      <CategoryTag text={game_day_copy.category_tag} />
      <h2 className={styles.headline}>{caption.headline}</h2>
      <p className={styles.text}>{caption.text}</p>
    </div>
  );
}
