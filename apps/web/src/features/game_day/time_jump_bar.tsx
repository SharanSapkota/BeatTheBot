import type { ReplayMoment } from "@voita_kone/shared_types";
import { useSearchParams } from "react-router";
import { DemoBadge } from "../../components/demo_badge";
import { class_names } from "../../lib/class_names";
import { useDemoMode } from "../../lib/demo_mode";
import { game_day_copy } from "./copy";
import styles from "./time_jump_bar.module.css";

/** Demo only: jump between before, live and final. The moment is kept in the URL. */
export function TimeJumpBar() {
  const { moment } = useDemoMode();
  const [, set_search_params] = useSearchParams();
  const pick = (next_moment: ReplayMoment) =>
    set_search_params({ demo: "1", moment: next_moment }, { replace: true });

  return (
    <div className={styles.bar}>
      <div className={styles.label_row}>
        <span className={styles.label}>{game_day_copy.time_jump_label}</span>
        <DemoBadge light_on_desktop />
      </div>
      <div role="group" aria-label={game_day_copy.time_jump_group} className={styles.options}>
        {game_day_copy.moments.map((option) => {
          const is_selected = option.id === moment;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={is_selected}
              className={class_names(styles.option, is_selected && styles.selected)}
              onClick={() => pick(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
