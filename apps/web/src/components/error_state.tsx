import { shared_copy } from "./copy";
import { PrimaryButton } from "./primary_button";
import styles from "./error_state.module.css";

interface ErrorStateProps {
  on_retry: () => void;
  text?: string;
}

/** Friendly error with a retry button. */
export function ErrorState({ on_retry, text = shared_copy.error_text }: ErrorStateProps) {
  return (
    <div className={styles.error} role="alert">
      <h2 className={styles.title}>{shared_copy.error_title}</h2>
      <p className={styles.text}>{text}</p>
      <PrimaryButton on_click={on_retry}>{shared_copy.try_again}</PrimaryButton>
    </div>
  );
}
