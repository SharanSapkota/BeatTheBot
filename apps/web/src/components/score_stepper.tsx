import styles from "./score_stepper.module.css";

export const MIN_GOALS = 0;
export const MAX_GOALS = 9;

interface ScoreStepperProps {
  team_name: string;
  value: number;
  on_change: (value: number) => void;
  disabled?: boolean;
}

/** Goals for one team, kept between 0 and 9. */
export function ScoreStepper({ team_name, value, on_change, disabled = false }: ScoreStepperProps) {
  const change_by = (delta: number) =>
    on_change(Math.max(MIN_GOALS, Math.min(MAX_GOALS, value + delta)));

  return (
    <div className={styles.stepper}>
      <span className={styles.team}>{team_name}</span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          aria-label={`${team_name} one goal less`}
          disabled={disabled || value <= MIN_GOALS}
          onClick={() => change_by(-1)}
        >
          −
        </button>
        <span className={styles.value} aria-live="polite" aria-label={`${team_name} goals`}>
          {value}
        </span>
        <button
          type="button"
          className={styles.button}
          aria-label={`${team_name} one goal more`}
          disabled={disabled || value >= MAX_GOALS}
          onClick={() => change_by(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
