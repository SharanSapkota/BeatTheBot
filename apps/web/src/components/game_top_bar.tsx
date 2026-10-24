import type { GameSummary } from "@voita_kone/shared_types";
import type { ReactNode } from "react";
import { useDemoMode } from "../lib/demo_mode";
import { BackLink } from "./back_link";
import { DemoBadge } from "./demo_badge";
import { SampleBadge } from "./sample_badge";
import styles from "./game_top_bar.module.css";

interface GameTopBarProps {
  status: ReactNode;
  /** The game: the back link opens its sport's tab; sample games get a "Sample data" badge. */
  game?: Pick<GameSummary, "sport" | "data_source">;
}

/** Top of every game screen: back link and status; badges for demo replays and sample data. */
export function GameTopBar({ status, game }: GameTopBarProps) {
  const { is_demo } = useDemoMode();
  const is_sample = game?.data_source === "demo";
  return (
    <div className={styles.top}>
      <div className={styles.bar}>
        <BackLink to={game ? `/games/${game.sport}` : undefined} />
        {status}
      </div>
      {(is_demo || is_sample) && (
        <div className={styles.demo_row}>
          {is_demo && <DemoBadge />}
          {is_sample && <SampleBadge on_dark />}
        </div>
      )}
    </div>
  );
}
