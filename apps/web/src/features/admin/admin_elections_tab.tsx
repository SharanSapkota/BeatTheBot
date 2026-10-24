import type { AdminCandidateInput, AdminElection } from "@voita_kone/shared_types";
import { useState } from "react";
import { Card } from "../../components/card";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { ApiError } from "../../lib/api_client";
import { class_names } from "../../lib/class_names";
import { ElectionView } from "../elections/election_view";
import { useAdminAction, type AdminAction } from "./api";
import { CandidateForm } from "./candidate_form";
import { admin_copy } from "./copy";
import { ElectionForm } from "./election_form";
import { ResultForm } from "./result_form";
import form_styles from "./admin_form.module.css";
import styles from "./admin_page.module.css";

const NEW = "new";

function can_enter_result(election: AdminElection, now: Date): boolean {
  return (
    election.status === "closed" ||
    election.status === "resulted" ||
    (election.status === "published" && now >= new Date(election.poll_closes_at))
  );
}

/** Admin tab "Elections": list on the left, the selected election's forms on the right. */
export function AdminElectionsTab({ elections }: { elections: AdminElection[] }) {
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [is_previewing, set_is_previewing] = useState(false);
  const [message, set_message] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const action = useAdminAction();

  const selected =
    selected_id === NEW ? undefined : elections.find((election) => election.id === selected_id);
  const show_form = selected_id === NEW || selected !== undefined;

  const run = async (change: AdminAction, ok_text: string = admin_copy.saved): Promise<boolean> => {
    set_message(null);
    try {
      const election = await action.mutateAsync(change);
      if (change.kind === "create" && election) {
        set_selected_id(election.id);
      }
      if (change.kind === "delete") {
        set_selected_id(null);
      }
      set_message({ kind: "ok", text: ok_text });
      return true;
    } catch (error) {
      set_message({
        kind: "error",
        text: error instanceof ApiError ? error.message : admin_copy.error_generic,
      });
      return false;
    }
  };

  const select = (id: string) => {
    set_selected_id(id);
    set_is_previewing(false);
    set_message(null);
  };

  return (
    <div className={styles.layout}>
      <nav aria-label={admin_copy.list_label} className={styles.list}>
        <button type="button" className={form_styles.button} onClick={() => select(NEW)}>
          {admin_copy.new_election}
        </button>
        {elections.length === 0 && <p>{admin_copy.no_elections}</p>}
        <ul className={styles.items}>
          {elections.map((election) => (
            <li key={election.id}>
              <button
                type="button"
                className={class_names(
                  styles.item,
                  election.id === selected_id && styles.item_selected,
                )}
                aria-current={election.id === selected_id ? "true" : undefined}
                onClick={() => select(election.id)}
              >
                <span className={styles.item_title}>
                  {admin_copy.list_item(election.title, election.area_name)}
                </span>
                <span className={styles.item_meta}>
                  {admin_copy.status[election.status]} · {election.election_date} ·{" "}
                  {admin_copy.picks_count(election.pick_count)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.detail}>
        {message && (
          <p
            className={message.kind === "ok" ? styles.status : form_styles.error}
            role={message.kind === "ok" ? "status" : "alert"}
          >
            {message.text}
          </p>
        )}
        {show_form && (
          <Card>
            <KalevaSectionTitle title={admin_copy.election_form_title(selected === undefined)} />
            <ElectionForm
              key={selected?.id ?? NEW}
              election={selected}
              is_saving={action.isPending}
              on_save={(body) =>
                void run(
                  selected
                    ? { kind: "update", election_id: selected.id, body }
                    : { kind: "create", body },
                )
              }
            />
            {selected?.status === "draft" && (
              <div className={form_styles.buttons}>
                <button
                  type="button"
                  className={form_styles.danger}
                  disabled={action.isPending}
                  onClick={() => void run({ kind: "delete", election_id: selected.id })}
                >
                  {admin_copy.delete_election}
                </button>
              </div>
            )}
          </Card>
        )}
        {selected && (
          <ElectionDetailForms
            election={selected}
            is_saving={action.isPending}
            is_previewing={is_previewing}
            on_toggle_preview={() => set_is_previewing((current) => !current)}
            run={run}
          />
        )}
      </div>
    </div>
  );
}

interface DetailFormsProps {
  election: AdminElection;
  is_saving: boolean;
  is_previewing: boolean;
  on_toggle_preview: () => void;
  run: (change: AdminAction, ok_text?: string) => Promise<boolean>;
}

function ElectionDetailForms({
  election,
  is_saving,
  is_previewing,
  on_toggle_preview,
  run,
}: DetailFormsProps) {
  const now = new Date();
  const is_draft = election.status === "draft";
  const can_edit_candidates = is_draft || election.status === "published";
  const save_candidate = (candidate_id: string | undefined) => (body: AdminCandidateInput) =>
    run(
      candidate_id
        ? { kind: "update_candidate", election_id: election.id, candidate_id, body }
        : { kind: "add_candidate", election_id: election.id, body },
    );

  return (
    <>
      <Card>
        <KalevaSectionTitle title={admin_copy.candidates_title} meta={admin_copy.candidates_hint} />
        {election.candidates.map((candidate, index) => (
          <CandidateForm
            key={`${candidate.id}_${election.updated_at}`}
            candidate={candidate}
            label={admin_copy.candidate_label(index + 1)}
            can_remove={is_draft}
            is_saving={is_saving || !can_edit_candidates}
            on_save={save_candidate(candidate.id)}
            on_remove={() =>
              void run({
                kind: "delete_candidate",
                election_id: election.id,
                candidate_id: candidate.id,
              })
            }
          />
        ))}
        {can_edit_candidates && (
          <CandidateForm
            key={`add_${election.id}`}
            candidate={undefined}
            label={admin_copy.add_candidate}
            can_remove={false}
            is_saving={is_saving}
            on_save={save_candidate(undefined)}
          />
        )}
      </Card>

      <Card>
        <KalevaSectionTitle title={admin_copy.actions_title} />
        <div className={form_styles.buttons}>
          <button type="button" className={form_styles.secondary} onClick={on_toggle_preview}>
            {is_previewing ? admin_copy.hide_preview : admin_copy.preview}
          </button>
          {is_draft && (
            <button
              type="button"
              className={form_styles.button}
              disabled={is_saving}
              onClick={() => void run({ kind: "publish", election_id: election.id })}
            >
              {admin_copy.publish}
            </button>
          )}
          {election.status === "published" && (
            <button
              type="button"
              className={form_styles.secondary}
              disabled={is_saving}
              onClick={() => void run({ kind: "close", election_id: election.id })}
            >
              {admin_copy.close}
            </button>
          )}
        </div>
        {is_draft && <p className={form_styles.hint}>{admin_copy.publish_hint}</p>}
        {can_enter_result(election, now) && (
          <>
            <h3>{admin_copy.result_title}</h3>
            <ResultForm
              key={`${election.id}_${election.updated_at}`}
              election={election}
              is_saving={is_saving}
              on_save={(body) =>
                void run(
                  { kind: "result", election_id: election.id, body },
                  admin_copy.result_saved,
                )
              }
            />
          </>
        )}
      </Card>

      {is_previewing && (
        <section className={styles.preview} aria-label={admin_copy.preview}>
          <p className={form_styles.hint}>{admin_copy.preview_note}</p>
          <ElectionView
            election={{
              ...election,
              my_pick: null,
              winner_candidate_id: election.result?.winner_candidate_id ?? null,
            }}
            results={undefined}
            picker={null}
            now={now}
          />
        </section>
      )}
    </>
  );
}
