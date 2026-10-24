import type { AiPrediction, GameSummary } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { RobotIcon } from "../../components/icons/robot_icon";
import { LabelNote } from "../../components/label_note";
import { ProgressSplitBar } from "../../components/progress_split_bar";
import { format_percent } from "../../lib/format";
import { before_copy } from "./copy";
import styles from "./ai_pick_card.module.css";

interface AiPickCardProps {
  game: GameSummary;
  prediction: AiPrediction;
}

/** The AI's pick with its win chance, reasons and label (blue accent). */
export function AiPickCard({ game, prediction }: AiPickCardProps) {
  const home_share = prediction.home_win_probability;
  const home_is_pick = prediction.predicted_winner_team_id === game.home_team.id;
  const pick_team = home_is_pick ? game.home_team : game.away_team;
  const pick_share = home_is_pick ? home_share : 1 - home_share;

  return (
    <Card accent="ai" gap={14} labelled_by="ai_pick_title">
      <div className={styles.head}>
        <span className={styles.icon}>
          <RobotIcon size={20} />
        </span>
        <div className={styles.titles}>
          <span className={styles.kicker}>{before_copy.ai_kicker}</span>
          <h2 id="ai_pick_title" className={styles.title}>
            {before_copy.ai_title(pick_team.name, format_percent(pick_share))}
          </h2>
        </div>
      </div>
      <ProgressSplitBar
        left_share={home_share}
        left_color="var(--color_ai)"
        right_color="var(--color_ai_track)"
        height={14}
        left_label={before_copy.team_share(game.home_team.name, format_percent(home_share))}
        right_label={before_copy.team_share(game.away_team.name, format_percent(1 - home_share))}
        bold_labels
      />
      <div className={styles.reasons}>
        <h3 className={styles.why}>{before_copy.why_title}</h3>
        <ul className={styles.list}>
          {prediction.reasons.map((reason) => (
            <li key={reason.fact_id} className={styles.reason}>
              <span className={styles.bullet} aria-hidden="true" />
              <span>{reason.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <LabelNote text={prediction.label_text} />
    </Card>
  );
}
