import type { Question } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import { format_percent } from "../../lib/format";
import { during_copy } from "./copy";
import styles from "./fan_poll.module.css";

interface FanPollProps {
  question: Question;
  /** The user's answer (option id), or null. */
  answer: string | null;
  /** False in demo replays: the answer stays on this device and can change. */
  is_saved: boolean;
  on_answer: (option_id: string) => void;
}

/** Best player so far, no points: pick a player, then see what all fans think (gray). */
export function FanPoll({ question, answer, is_saved, on_answer }: FanPollProps) {
  const shares = question.shares;
  const can_answer = !question.is_locked && !(is_saved && answer !== null);
  return (
    <Card gap={10}>
      <KalevaSectionTitle
        mobile_variant="card"
        title={during_copy.fan_poll_title}
        right={<span className={styles.no_points}>{during_copy.no_points}</span>}
      />
      {shares ? (
        <div className={styles.rows}>
          {question.options.map((option) => {
            const share = shares.find((item) => item.option_id === option.id)?.share ?? 0;
            return (
              <div key={option.id} className={styles.row}>
                <span className={class_names(styles.label, option.id === answer && styles.mine)}>
                  {option.label}
                </span>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.fill} style={{ width: format_percent(share) }} />
                </span>
                <span className={styles.value}>{format_percent(share)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div role="group" aria-label={during_copy.fan_poll_group} className={styles.options}>
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === answer}
              disabled={!can_answer}
              className={class_names(styles.option, option.id === answer && styles.selected)}
              onClick={() => on_answer(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
