import { format_number } from "../lib/format";
import { shared_copy } from "./copy";
import styles from "./app_header.module.css";

interface AppHeaderProps {
  /** The user's total points; hidden while unknown. */
  total_points: number | undefined;
}

/** Hub header: app name and the user's points. */
export function AppHeader({ total_points }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.name}>{shared_copy.app_name}</span>
        <span className={styles.tagline}>{shared_copy.app_tagline}</span>
      </div>
      {total_points !== undefined && (
        <span className={styles.points}>
          {format_number(total_points)} {shared_copy.points_suffix}
        </span>
      )}
    </header>
  );
}
