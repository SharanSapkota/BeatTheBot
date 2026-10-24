import type {
  AdminElection,
  AdminElectionInput,
  AreaType,
  ElectionType,
} from "@voita_kone/shared_types";
import { useId, useState, type FormEvent } from "react";
import { admin_copy } from "./copy";
import { from_local_input, local_date_in, to_local_input } from "./local_time";
import styles from "./admin_form.module.css";

interface ElectionFormProps {
  /** Undefined = a new election. */
  election: AdminElection | undefined;
  is_saving: boolean;
  on_save: (body: AdminElectionInput) => void;
}

interface FormValues {
  title: string;
  election_type: ElectionType;
  area_type: AreaType;
  area_name: string;
  election_date: string;
  poll_opens_at: string;
  poll_closes_at: string;
  question_text: string;
  is_demo: boolean;
}

function initial_values(election: AdminElection | undefined, now: Date): FormValues {
  if (election) {
    return {
      title: election.title,
      election_type: election.election_type,
      area_type: election.area_type,
      area_name: election.area_name,
      election_date: election.election_date,
      poll_opens_at: to_local_input(election.poll_opens_at),
      poll_closes_at: to_local_input(election.poll_closes_at),
      question_text: election.question_text,
      is_demo: election.is_demo,
    };
  }
  const election_date = local_date_in(30, now);
  return {
    title: "",
    election_type: "municipal",
    area_type: "municipality",
    area_name: "",
    election_date,
    poll_opens_at: to_local_input(now.toISOString()),
    poll_closes_at: `${election_date}T20:00`,
    question_text: "",
    is_demo: false,
  };
}

/** Create or edit an election. The API validates again (zod + the poll window rule). */
export function ElectionForm({ election, is_saving, on_save }: ElectionFormProps) {
  const [values, set_values] = useState(() => initial_values(election, new Date()));
  const hint_id = useId();
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    set_values((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    on_save({
      ...values,
      poll_opens_at: from_local_input(values.poll_opens_at),
      poll_closes_at: from_local_input(values.poll_closes_at),
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.grid}>
        <label className={`${styles.field} ${styles.wide}`}>
          {admin_copy.field_title}
          <input
            value={values.title}
            maxLength={120}
            required
            onChange={(event) => set("title", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_type}
          <select
            value={values.election_type}
            onChange={(event) => set("election_type", event.target.value as ElectionType)}
          >
            {Object.entries(admin_copy.election_types).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          {admin_copy.field_area_type}
          <select
            value={values.area_type}
            onChange={(event) => set("area_type", event.target.value as AreaType)}
          >
            {Object.entries(admin_copy.area_types).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          {admin_copy.field_area_name}
          <input
            value={values.area_name}
            maxLength={80}
            required
            onChange={(event) => set("area_name", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_date}
          <input
            type="date"
            value={values.election_date}
            required
            onChange={(event) => set("election_date", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_opens}
          <input
            type="datetime-local"
            value={values.poll_opens_at}
            required
            onChange={(event) => set("poll_opens_at", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          {admin_copy.field_closes}
          <input
            type="datetime-local"
            value={values.poll_closes_at}
            required
            aria-describedby={hint_id}
            onChange={(event) => set("poll_closes_at", event.target.value)}
          />
          <span id={hint_id} className={styles.hint}>
            {admin_copy.closes_hint}
          </span>
        </label>
        <label className={`${styles.field} ${styles.wide}`}>
          {admin_copy.field_question}
          <input
            value={values.question_text}
            maxLength={200}
            onChange={(event) => set("question_text", event.target.value)}
          />
          <span className={styles.hint}>{admin_copy.question_hint(values.area_name)}</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.is_demo}
            onChange={(event) => set("is_demo", event.target.checked)}
          />
          {admin_copy.field_demo}
        </label>
      </div>
      <div className={styles.buttons}>
        <button type="submit" className={styles.button} disabled={is_saving}>
          {election ? admin_copy.save : admin_copy.create}
        </button>
      </div>
    </form>
  );
}
