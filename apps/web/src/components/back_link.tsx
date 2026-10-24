import { Link } from "react-router";
import { useDemoMode } from "../lib/demo_mode";
import { shared_copy } from "./copy";
import { ChevronLeftIcon } from "./icons/chevron_left_icon";
import styles from "./back_link.module.css";

/** Back to the hub on the game screens: "‹ Game day" (mobile), "‹ Today's games" (desktop). */
export function BackLink() {
  const { link_to } = useDemoMode();
  return (
    <Link to={link_to("/")} className={styles.link}>
      <ChevronLeftIcon />
      <span className="mobile_only">{shared_copy.back_to_game_day}</span>
      <span className="desktop_only">{shared_copy.back_to_today}</span>
    </Link>
  );
}
