import styles from "./category_tag.module.css";

/** Kaleva category tag: gray box, white uppercase text ("HOCKEY · LIIGA"). */
export function CategoryTag({ text }: { text: string }) {
  return <span className={styles.tag}>{text}</span>;
}
