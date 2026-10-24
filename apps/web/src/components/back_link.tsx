import { Link } from "react-router";
import { useDemoMode } from "../lib/demo_mode";
import { shared_copy } from "./copy";
import { ChevronLeftIcon } from "./icons/chevron_left_icon";
import styles from "./back_link.module.css";

interface BackLinkProps {
  /** Defaults to the games hub. */
  to?: string;
  /** One label for both layouts; without it "‹ Game day" (mobile) / "‹ Today's games" (desktop). */
  label?: string;
}

/** Back link: to the hub on the game screens, or to a list (e.g. "‹ Elections"). */
export function BackLink({ to = "/games", label }: BackLinkProps) {
  const { link_to } = useDemoMode();
  return (
    <Link to={link_to(to)} className={styles.link}>
      <ChevronLeftIcon />
      {label === undefined ? (
        <>
          <span className="mobile_only">{shared_copy.back_to_game_day}</span>
          <span className="desktop_only">{shared_copy.back_to_today}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </Link>
  );
}
