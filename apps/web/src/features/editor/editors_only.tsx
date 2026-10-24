import { Card } from "../../components/card";
import { editor_copy } from "./copy";
import styles from "./editors_only.module.css";

/** Shown when signed out or when the account is not an editor or admin. */
export function EditorsOnly({ user_id }: { user_id: string | undefined }) {
  return (
    <Card labelled_by="editors_only_title">
      <h1 id="editors_only_title" className={styles.title}>
        {editor_copy.editors_only_title}
      </h1>
      <p>{editor_copy.editors_only_text}</p>
      {user_id === undefined ? (
        <p>{editor_copy.signed_out_hint}</p>
      ) : (
        <>
          <p>{editor_copy.your_user_id(user_id)}</p>
          <p>{editor_copy.make_editor_hint}</p>
          <code className={styles.command}>{editor_copy.make_editor_command(user_id)}</code>
        </>
      )}
    </Card>
  );
}
