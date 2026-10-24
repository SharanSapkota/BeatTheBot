import { DISPLAY_NAME_MAX_LENGTH, display_name_schema } from "@voita_kone/shared_types";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PrimaryButton } from "../../components/primary_button";
import { account_copy } from "./copy";
import styles from "./name_dialog.module.css";

interface NameDialogProps {
  /** Resolves when signed in; throws to show the error in the dialog. */
  on_submit: (display_name: string) => Promise<void>;
  on_cancel: () => void;
  /** The submit button text; "Save and lock in" by default. */
  submit_text?: string;
}

/** Asks for a display name on the first lock-in or answer, then creates the device account. */
export function NameDialog({
  on_submit,
  on_cancel,
  submit_text = account_copy.submit,
}: NameDialogProps) {
  const [name, set_name] = useState("");
  const [error, set_error] = useState<string | null>(null);
  const [is_submitting, set_is_submitting] = useState(false);
  const input_ref = useRef<HTMLInputElement>(null);
  const title_id = useId();
  const text_id = useId();
  const error_id = useId();

  useEffect(() => {
    input_ref.current?.focus();
  }, []);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = display_name_schema.safeParse(name);
    if (!parsed.success) {
      set_error(account_copy.name_required);
      return;
    }
    set_is_submitting(true);
    set_error(null);
    try {
      await on_submit(parsed.data);
    } catch {
      set_error(account_copy.sign_in_failed);
      set_is_submitting(false);
    }
  };

  const on_key_down = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !is_submitting) {
      on_cancel();
    }
  };

  return (
    <div className={styles.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title_id}
        aria-describedby={text_id}
        className={styles.dialog}
        onKeyDown={on_key_down}
      >
        <h2 id={title_id} className={styles.title}>
          {account_copy.dialog_title}
        </h2>
        <p id={text_id} className={styles.text}>
          {account_copy.dialog_text}
        </p>
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <label className={styles.label}>
            {account_copy.name_label}
            <input
              ref={input_ref}
              className={styles.input}
              value={name}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="nickname"
              aria-invalid={error !== null}
              aria-describedby={error ? error_id : undefined}
              onChange={(event) => set_name(event.target.value)}
            />
          </label>
          {error && (
            <p id={error_id} className={styles.error} role="alert">
              {error}
            </p>
          )}
          <PrimaryButton on_click={() => void submit()} disabled={is_submitting}>
            {is_submitting ? account_copy.submitting : submit_text}
          </PrimaryButton>
          <button
            type="button"
            className={styles.cancel}
            onClick={on_cancel}
            disabled={is_submitting}
          >
            {account_copy.cancel}
          </button>
        </form>
      </div>
    </div>
  );
}
