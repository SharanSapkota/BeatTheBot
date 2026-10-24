import type { ReactNode } from "react";
import styles from "./primary_button.module.css";

interface PrimaryButtonProps {
  on_click: () => void;
  children: ReactNode;
  disabled?: boolean;
}

/** Orange main action, 52 px high. */
export function PrimaryButton({ on_click, children, disabled = false }: PrimaryButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={on_click} disabled={disabled}>
      {children}
    </button>
  );
}
