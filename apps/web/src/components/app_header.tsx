import { Link } from "react-router";
import { class_names } from "../lib/class_names";
import { format_number } from "../lib/format";
import { shared_copy } from "./copy";
import { useMainNav } from "./use_main_nav";
import styles from "./app_header.module.css";

interface AppHeaderProps {
  /** The user's total points; hidden while unknown. */
  total_points: number | undefined;
  /** The phone layout shows the dark header on the hub only; desktop always shows it. */
  on_mobile?: "shown" | "hidden";
}

/** App name, the main nav (desktop: Games · Elections · Rooms · Leaders) and the user's points. */
export function AppHeader({ total_points, on_mobile = "shown" }: AppHeaderProps) {
  const nav_items = useMainNav();
  return (
    <header className={class_names(styles.header, on_mobile === "hidden" && styles.desktop_only)}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.name}>{shared_copy.app_name}</span>
          <span className={styles.tagline}>{shared_copy.app_tagline}</span>
        </div>
        <nav aria-label={shared_copy.nav_label} className={styles.nav}>
          {nav_items.map(({ to, label, is_active }) => (
            <Link
              key={to}
              to={to}
              aria-current={is_active ? "page" : undefined}
              className={class_names(styles.nav_link, is_active && styles.active)}
            >
              {label}
            </Link>
          ))}
        </nav>
        {total_points !== undefined && (
          <span className={styles.points}>
            {format_number(total_points)} {shared_copy.points_suffix}
          </span>
        )}
      </div>
    </header>
  );
}
