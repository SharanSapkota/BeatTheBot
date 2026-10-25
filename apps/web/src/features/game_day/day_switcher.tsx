import { ChevronLeftIcon } from "../../components/icons/chevron_left_icon";
import { ChevronRightIcon } from "../../components/icons/chevron_right_icon";
import { add_days_to_date, format_date_label, format_relative_day } from "../../lib/format";
import { game_day_copy } from "./copy";
import styles from "./day_switcher.module.css";

interface DaySwitcherProps {
  /** The shown Helsinki day, "2026-10-25". */
  date: string;
  today: string;
  on_change: (date: string) => void;
}

/** ‹ yesterday · today · tomorrow › in Helsinki time; any day can be browsed. */
export function DaySwitcher({ date, today, on_change }: DaySwitcherProps) {
  const label = format_relative_day(date, today);
  return (
    <div role="group" aria-label={game_day_copy.day_switcher_label} className={styles.switcher}>
      <button
        type="button"
        className={styles.arrow}
        aria-label={`${game_day_copy.previous_day}: ${format_date_label(add_days_to_date(date, -1))}`}
        onClick={() => on_change(add_days_to_date(date, -1))}
      >
        <ChevronLeftIcon />
      </button>
      <span className={styles.label} aria-live="polite">
        <span className={styles.day}>{label}</span>
        {label !== format_date_label(date) && (
          <span className={styles.date}>{format_date_label(date)}</span>
        )}
      </span>
      <button
        type="button"
        className={styles.arrow}
        aria-label={`${game_day_copy.next_day}: ${format_date_label(add_days_to_date(date, 1))}`}
        onClick={() => on_change(add_days_to_date(date, 1))}
      >
        <ChevronRightIcon />
      </button>
      {date !== today && (
        <button type="button" className={styles.today} onClick={() => on_change(today)}>
          {game_day_copy.back_to_today}
        </button>
      )}
    </div>
  );
}
