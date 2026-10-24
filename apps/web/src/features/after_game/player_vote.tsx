import type { Question } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { class_names } from "../../lib/class_names";
import type { GamePicks } from "../../lib/picks";
import { after_copy } from "./copy";
import styles from "./player_vote.module.css";

interface PlayerVoteProps {
  question: Question;
  picks: GamePicks;
  /** False in demo replays: the vote stays on this device and can change. */
  is_saved: boolean;
  on_answer: (option_id: string) => void;
}

/** Player of the game: pill buttons, the chosen one dark. Real games: one vote. */
export function PlayerVote({ question, picks, is_saved, on_answer }: PlayerVoteProps) {
  const can_vote = !question.is_locked && !(is_saved && picks.vote_player !== null);
  return (
    <Card>
      <KalevaSectionTitle
        mobile_variant="card"
        title={after_copy.vote_title}
        right={<PointsBadge text={`+${String(question.points)}`} />}
      />
      <div role="group" aria-label={after_copy.vote_group} className={styles.options}>
        {question.options.map((option) => {
          const is_selected = option.id === picks.vote_player;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={is_selected}
              disabled={!can_vote && !is_selected}
              className={class_names(styles.option, is_selected && styles.selected)}
              onClick={() => {
                if (can_vote) {
                  on_answer(option.id);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
