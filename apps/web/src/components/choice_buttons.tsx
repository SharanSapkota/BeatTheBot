import type { CSSProperties } from "react";
import { class_names } from "../lib/class_names";
import styles from "./choice_buttons.module.css";

export interface Choice {
  id: string;
  label: string;
}

interface ChoiceButtonsProps {
  label: string;
  choices: readonly Choice[];
  selected_id: string | null;
  on_select: (id: string) => void;
  /** "large" = 56 px team buttons; "medium" = 52 px live-pick buttons. */
  size?: "large" | "medium";
  disabled?: boolean;
  /** Buttons per row; all in one row by default. */
  columns?: number;
}

/** A row of mutually exclusive choices: selected = orange, others white. */
export function ChoiceButtons({
  label,
  choices,
  selected_id,
  on_select,
  size = "large",
  disabled = false,
  columns = choices.length,
}: ChoiceButtonsProps) {
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
  };
  return (
    <div role="group" aria-label={label} className={styles.group} style={style}>
      {choices.map((choice) => {
        const is_selected = choice.id === selected_id;
        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={is_selected}
            disabled={disabled}
            className={class_names(styles.choice, styles[size], is_selected && styles.selected)}
            onClick={() => on_select(choice.id)}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
