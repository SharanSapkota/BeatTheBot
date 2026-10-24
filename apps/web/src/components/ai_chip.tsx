import { RobotIcon } from "./icons/robot_icon";
import styles from "./ai_chip.module.css";

/** Blue chip with the robot: the AI's view in one line. */
export function AiChip({ text }: { text: string }) {
  return (
    <div className={styles.chip}>
      <span className={styles.icon}>
        <RobotIcon />
      </span>
      <span className={styles.text}>{text}</span>
    </div>
  );
}
