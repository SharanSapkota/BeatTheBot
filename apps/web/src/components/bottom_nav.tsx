import { Link, useLocation } from "react-router";
import { class_names } from "../lib/class_names";
import { useDemoMode } from "../lib/demo_mode";
import { shared_copy } from "./copy";
import styles from "./bottom_nav.module.css";

/** Games and Leaders, as in the design. Keeps demo mode in the links. */
export function BottomNav() {
  const { pathname } = useLocation();
  const { link_to } = useDemoMode();
  const is_leaders = pathname.startsWith("/leaderboard");
  const items = [
    { path: "/", label: shared_copy.nav_games, is_active: !is_leaders },
    { path: "/leaderboard", label: shared_copy.nav_leaders, is_active: is_leaders },
  ];

  return (
    <nav aria-label={shared_copy.nav_label} className={styles.nav}>
      {items.map((item) => (
        <Link
          key={item.path}
          to={link_to(item.path)}
          aria-current={item.is_active ? "page" : undefined}
          className={class_names(styles.link, item.is_active && styles.active)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
