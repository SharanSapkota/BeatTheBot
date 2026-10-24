import type { Sport } from "@voita_kone/shared_types";
import { Link } from "react-router";
import { shared_copy } from "../../components/copy";
import { class_names } from "../../lib/class_names";
import { useDemoMode } from "../../lib/demo_mode";
import { SPORT_IDS } from "../../lib/sports";
import { useSports } from "./api";
import { game_day_copy } from "./copy";
import styles from "./sport_tabs.module.css";

/** Hockey · Football · Basketball chips with today's game counts; each is a link (/games/:sport). */
export function SportTabs({ selected }: { selected: Sport }) {
  const { link_to } = useDemoMode();
  const sports = useSports().data?.sports;

  return (
    <nav aria-label={game_day_copy.sport_tabs_label} className={styles.tabs}>
      {SPORT_IDS.map((sport) => {
        const count = sports?.find((row) => row.sport === sport)?.game_count;
        const is_selected = sport === selected;
        const name = shared_copy.sport_names[sport];
        return (
          <Link
            key={sport}
            to={link_to(`/games/${sport}`)}
            aria-current={is_selected ? "page" : undefined}
            aria-label={count === undefined ? name : game_day_copy.sport_tab_label(name, count)}
            className={class_names(styles.tab, is_selected && styles.selected)}
          >
            <span>{name}</span>
            {count !== undefined && <span className={styles.count}>{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
