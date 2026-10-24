import type { GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { ProgressSplitBar } from "../../components/progress_split_bar";
import { format_number, format_percent } from "../../lib/format";
import { useCrowd } from "../game/api";
import { before_copy } from "./copy";
import styles from "./data_says_card.module.css";

/**
 * Sports without the prediction model (football, basketball): how the fans have picked so far,
 * in place of "Data says". Football shows the draw share too.
 */
export function FansSoFarCard({ game }: { game: GameSummary }) {
  const crowd = useCrowd(game.id).data;
  const share = (picks: number) => format_percent(crowd ? picks / crowd.total_picks : 0);

  return (
    <Card gap={12} labelled_by="fans_so_far_title">
      <KalevaSectionTitle
        title={before_copy.fans_title}
        mobile_variant="card"
        id="fans_so_far_title"
      />
      <p className={styles.pending}>{before_copy.no_data_says}</p>
      <div className={styles.fans}>
        {crowd ? (
          <>
            <span className={styles.fans_label}>
              {before_copy.fans_so_far(format_number(crowd.total_picks))}
            </span>
            <ProgressSplitBar
              left_share={crowd.home_picks / Math.max(1, crowd.home_picks + crowd.away_picks)}
              left_color="var(--color_fans)"
              right_color="var(--color_fans_track)"
              height={10}
              left_label={before_copy.team_share(game.home_team.name, share(crowd.home_picks))}
              right_label={before_copy.team_share(game.away_team.name, share(crowd.away_picks))}
            />
            {crowd.draw_picks > 0 && (
              <span className={styles.fans_label}>
                {before_copy.fans_draw_share(share(crowd.draw_picks))}
              </span>
            )}
          </>
        ) : (
          <span className={styles.fans_label}>{before_copy.fans_none}</span>
        )}
      </div>
    </Card>
  );
}
