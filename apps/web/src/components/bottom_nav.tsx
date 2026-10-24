import { Link } from "react-router";
import { class_names } from "../lib/class_names";
import { shared_copy } from "./copy";
import { useMainNav } from "./use_main_nav";
import styles from "./bottom_nav.module.css";

/** Games and Leaders at the bottom of the phone layout (the desktop header has its own nav). */
export function BottomNav() {
  return (
    <nav aria-label={shared_copy.nav_label} className={styles.nav}>
      {useMainNav().map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={item.is_active ? "page" : undefined}
          className={class_names(styles.link, item.is_active && styles.active)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
