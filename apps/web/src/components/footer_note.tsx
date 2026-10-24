import styles from "./footer_note.module.css";

/** Small print at the end of a screen. */
export function FooterNote({ text }: { text: string }) {
  return <p className={styles.note}>{text}</p>;
}
