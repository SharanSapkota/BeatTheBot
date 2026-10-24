import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { ScoreStepper } from "../../components/score_stepper";
import { SectionTitle } from "../../components/section_title";
import { with_prematch_change } from "../../lib/picks";
import { before_copy } from "./copy";
import type { PickProps } from "./winner_pick";
import styles from "./exact_score_pick.module.css";

export function ExactScorePick({ game, picks, update, disabled, number, points }: PickProps) {
  return (
    <Card>
      <SectionTitle
        title={before_copy.numbered(number, before_copy.pick_titles.exact_score)}
        size={16}
        right={<PointsBadge text={`+${String(points)}`} />}
      />
      <div className={styles.row}>
        <ScoreStepper
          team_name={game.home_team.name}
          value={picks.home_goals}
          disabled={disabled}
          on_change={(home_goals) =>
            update((current) => with_prematch_change(current, { home_goals }))
          }
        />
        <span className={styles.dash} aria-hidden="true">
          –
        </span>
        <ScoreStepper
          team_name={game.away_team.name}
          value={picks.away_goals}
          disabled={disabled}
          on_change={(away_goals) =>
            update((current) => with_prematch_change(current, { away_goals }))
          }
        />
      </div>
      <p className={styles.note}>{before_copy.score_note[game.sport]}</p>
    </Card>
  );
}
