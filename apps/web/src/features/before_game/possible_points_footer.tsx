import { Card } from "../../components/card";
import { CheckIcon } from "../../components/icons/check_icon";
import { PrimaryButton } from "../../components/primary_button";
import { format_clock_time } from "../../lib/format";
import { before_copy } from "./copy";
import styles from "./possible_points_footer.module.css";

interface PossiblePointsFooterProps {
  possible_points: number;
  start_time: string;
  has_winner: boolean;
  is_saved: boolean;
  is_past_start: boolean;
  on_lock_in: () => void;
}

/** Possible points, and "Lock in my picks" or the saved state. */
export function PossiblePointsFooter({
  possible_points,
  start_time,
  has_winner,
  is_saved,
  is_past_start,
  on_lock_in,
}: PossiblePointsFooterProps) {
  let action = (
    <PrimaryButton on_click={on_lock_in} disabled={!has_winner}>
      {has_winner ? before_copy.lock_button : before_copy.pick_winner_first}
    </PrimaryButton>
  );
  if (is_past_start) {
    action = <div className={styles.closed}>{before_copy.locked_at_start}</div>;
  } else if (is_saved) {
    action = (
      <div className={styles.saved} role="status">
        <CheckIcon />
        {before_copy.saved(format_clock_time(start_time))}
      </div>
    );
  }

  return (
    <Card tone="navy">
      <div className={styles.top}>
        <span className={styles.label}>{before_copy.possible_title}</span>
        <span className={styles.points}>{before_copy.points(possible_points)}</span>
      </div>
      <p className={styles.bonus}>
        {before_copy.bonus_before}
        <b className={styles.strong}>{before_copy.bonus_strong}</b>
        {before_copy.bonus_after}
      </p>
      {action}
    </Card>
  );
}
