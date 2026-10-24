import { class_names } from "../lib/class_names";
import { RobotIcon } from "./icons/robot_icon";
import styles from "./ai_chip.module.css";

interface AiChipProps {
  text: string;
  /** "hero": a chip on mobile, plain white text in the dark desktop hero. */
  variant?: "chip" | "hero";
  /** "ai": the blue "Data says" chip with the robot; "fans": the gray fans chip. */
  tone?: "ai" | "fans";
}

/** One line of neutral info: "Data says" (blue, robot) or how the fans picked (gray). */
export function AiChip({ text, variant = "chip", tone = "ai" }: AiChipProps) {
  return (
    <div className={class_names(styles.chip, styles[variant], tone === "fans" && styles.fans)}>
      {tone === "ai" && (
        <span className={styles.icon}>
          <RobotIcon />
        </span>
      )}
      <span className={styles.text}>{text}</span>
    </div>
  );
}
