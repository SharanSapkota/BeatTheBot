import type { AiPrediction, GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { ProgressSplitBar } from "../../components/progress_split_bar";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { format_number, format_percent } from "../../lib/format";
import { before_copy } from "./copy";
import styles from "./stakes_card.module.css";

interface StakesCardProps {
  game: GameSummary;
  prediction: AiPrediction;
}

/** Playoff / relegation odds if the team wins or loses, and how the fans have picked. */
export function StakesCard({ game, prediction }: StakesCardProps) {
  const team_name = (team_id: string) =>
    team_id === game.home_team.id ? game.home_team.name : game.away_team.name;
  const { crowd } = prediction;

  return (
    <Card gap={10}>
      <KalevaSectionTitle title={before_copy.stakes_title} mobile_variant="card" />
      <div className={styles.grid}>
        {prediction.stakes.map((stake) => (
          <div key={`${stake.team_id}_${stake.kind}`} className={styles.stake}>
            <span className={styles.label}>
              {before_copy.stake_label[stake.kind](team_name(stake.team_id))}
            </span>
            <span className={styles.values}>
              {before_copy.win} <b className={styles.good}>{format_percent(stake.if_win)}</b> ·{" "}
              {before_copy.lose} <b className={styles.bad}>{format_percent(stake.if_loss)}</b>
            </span>
          </div>
        ))}
      </div>
      <div className={styles.fans}>
        {crowd ? (
          <>
            <span className={styles.fans_label}>
              {before_copy.fans_so_far(format_number(crowd.total_picks))}
            </span>
            <ProgressSplitBar
              left_share={crowd.home_pick_share}
              left_color="var(--color_fans)"
              right_color="var(--color_fans_track)"
              height={10}
              left_label={before_copy.team_share(
                game.home_team.name,
                format_percent(crowd.home_pick_share),
              )}
              right_label={before_copy.team_share(
                game.away_team.name,
                format_percent(1 - crowd.home_pick_share),
              )}
            />
          </>
        ) : (
          <span className={styles.fans_label}>{before_copy.fans_none}</span>
        )}
      </div>
    </Card>
  );
}
