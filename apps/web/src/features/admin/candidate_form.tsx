import {
  CANDIDATE_BIO_MAX_LENGTH,
  type AdminCandidateInput,
  type ElectionCandidate,
} from "@voita_kone/shared_types";
import { useState, type FormEvent } from "react";
import { admin_copy } from "./copy";
import styles from "./admin_form.module.css";

interface CandidateFormProps {
  /** Undefined = add a new candidate. */
  candidate: ElectionCandidate | undefined;
  label: string;
  can_remove: boolean;
  is_saving: boolean;
  on_save: (body: AdminCandidateInput) => Promise<boolean>;
  on_remove?: () => void;
}

const EMPTY = {
  full_name: "",
  party_or_group: "",
  candidate_number: "",
  short_bio: "",
  photo_url: "",
};

function initial(candidate: ElectionCandidate | undefined) {
  if (!candidate) {
    return EMPTY;
  }
  return {
    full_name: candidate.full_name,
    party_or_group: candidate.party_or_group ?? "",
    candidate_number: candidate.candidate_number === null ? "" : String(candidate.candidate_number),
    short_bio: candidate.short_bio,
    photo_url: candidate.photo_url ?? "",
  };
}

/** One candidate: the same fields for everyone, written by the admin (no AI text). */
export function CandidateForm({
  candidate,
  label,
  can_remove,
  is_saving,
  on_save,
  on_remove,
}: CandidateFormProps) {
  const [values, set_values] = useState(() => initial(candidate));
  const set = (key: keyof typeof EMPTY, value: string) =>
    set_values((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await on_save({
      full_name: values.full_name,
      party_or_group: values.party_or_group || null,
      candidate_number: values.candidate_number === "" ? null : Number(values.candidate_number),
      short_bio: values.short_bio,
      photo_url: values.photo_url || null,
    });
    if (saved && !candidate) {
      set_values(EMPTY);
    }
  };

  return (
    <form className={styles.form} aria-label={label} onSubmit={(event) => void submit(event)}>
      <div className={styles.grid}>
        <label className={styles.field}>
          {admin_copy.field_name}
          <input
            value={values.full_name}
            maxLength={80}
            required
            onChange={(event) => set("full_name", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_party}
          <input
            value={values.party_or_group}
            maxLength={80}
            onChange={(event) => set("party_or_group", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_number}
          <input
            type="number"
            min={1}
            value={values.candidate_number}
            onChange={(event) => set("candidate_number", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_photo}
          <input
            type="url"
            pattern="https://.*"
            value={values.photo_url}
            onChange={(event) => set("photo_url", event.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.wide}`}>
          {admin_copy.field_bio(values.short_bio.length)}
          <textarea
            value={values.short_bio}
            maxLength={CANDIDATE_BIO_MAX_LENGTH}
            onChange={(event) => set("short_bio", event.target.value)}
          />
        </label>
      </div>
      <div className={styles.buttons}>
        <button type="submit" className={styles.secondary} disabled={is_saving}>
          {candidate ? admin_copy.save_candidate : admin_copy.add_candidate}
        </button>
        {candidate && can_remove && on_remove && (
          <button type="button" className={styles.danger} disabled={is_saving} onClick={on_remove}>
            {admin_copy.remove_candidate}
          </button>
        )}
      </div>
    </form>
  );
}
