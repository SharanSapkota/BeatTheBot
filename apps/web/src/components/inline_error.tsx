import styles from "./inline_error.module.css";

/** A short error under a card, e.g. when an answer was not saved. */
export function InlineError({ text }: { text: string }) {
  return (
    <p className={styles.error} role="alert">
      {text}
    </p>
  );
}
