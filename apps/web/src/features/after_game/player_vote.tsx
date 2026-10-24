import { Card } from "../../components/card";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { class_names } from "../../lib/class_names";
import type { GamePicks } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { after_copy } from "./copy";
import styles from "./player_vote.module.css";

interface PlayerVoteProps {
  options: readonly string[];
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
}

/** Player of the game: pill buttons, the chosen one navy. */
export function PlayerVote({ options, picks, update }: PlayerVoteProps) {
  return (
    <Card>
      <SectionTitle
        title={after_copy.vote_title}
        right={<PointsBadge text={`+${String(POINTS.vote)}`} />}
      />
      <div role="group" aria-label={after_copy.vote_group} className={styles.options}>
        {options.map((name) => {
          const is_selected = name === picks.vote_player;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={is_selected}
              className={class_names(styles.option, is_selected && styles.selected)}
              onClick={() => update((current) => ({ ...current, vote_player: name }))}
            >
              {name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
