import type { DataSays, GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { LabelNote } from "../../components/label_note";
import { ProgressSplitBar } from "../../components/progress_split_bar";
import { format_clock_time, format_number, format_percent } from "../../lib/format";
import { before_copy } from "./copy";
import styles from "./data_says_card.module.css";

interface DataSaysCardProps {
  game: GameSummary;
  /** null = not calculated yet. */
  data_says: DataSays | null;
}

/**
 * "Data says": neutral numbers from the prediction model, never a pick. The win chance, the
 * playoff / relegation odds if the team wins or loses, and how the fans have picked.
 */
export function DataSaysCard({ game, data_says }: DataSaysCardProps) {
  const team_name = (team_id: string) =>
    team_id === game.home_team.id ? game.home_team.name : game.away_team.name;
  const crowd = data_says?.crowd ?? null;

  return (
    <Card gap={12} labelled_by="data_says_title">
      <KalevaSectionTitle
        title={before_copy.data_says_title}
        mobile_variant="card"
        id="data_says_title"
      />
      {data_says === null && <p className={styles.pending}>{before_copy.data_not_ready}</p>}
      {data_says && (
        <>
          <div className={styles.chance}>
            <span className={styles.chance_label}>{before_copy.win_chance_title}</span>
            <ProgressSplitBar
              left_share={data_says.home_win_probability}
              left_color="var(--color_ai)"
              right_color="var(--color_ai_track)"
              height={12}
              left_label={before_copy.team_share(
                game.home_team.name,
                format_percent(data_says.home_win_probability),
              )}
              right_label={before_copy.team_share(
                game.away_team.name,
                format_percent(data_says.away_win_probability),
              )}
              bold_labels
            />
          </div>
          <span className={styles.chance_label}>{before_copy.stakes_title}</span>
          <div className={styles.grid}>
            {data_says.stakes.map((stake) => (
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
        </>
      )}
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
      {data_says && (
        <LabelNote text={before_copy.data_says_label(format_clock_time(data_says.calculated_at))} />
      )}
    </Card>
  );
}
