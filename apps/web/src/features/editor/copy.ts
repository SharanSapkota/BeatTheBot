import type { ClaimStatus, EditorActionResult, TrafficLightValue } from "@voita_kone/shared_types";

// Editor page (/editor) text. The page is for the Kaleva sports desk, not for fans.
export const editor_copy = {
  title: "Editor queue",
  meta: "AI stories waiting for a human check",
  editors_only_title: "Editors only",
  editors_only_text: "This page is for the Kaleva sports desk.",
  your_user_id: (user_id: string) => `Your user id: ${user_id}`,
  signed_out_hint: "Sign in on this device first (lock in a pick), then open this page again.",
  make_editor_hint: "To make this account an editor, run:",
  make_editor_command: (user_id: string) => `pnpm --filter api make:editor -- --user_id ${user_id}`,
  queue_label: "Stories in review",
  queue_empty_title: "The queue is empty",
  queue_empty_text: "No AI stories are waiting for review.",
  traffic_light: {
    green: "🟢 Green",
    yellow: "🟡 Yellow",
    red: "🔴 Red",
  } satisfies Record<TrafficLightValue, string>,
  queue_item_name: (game: string, story_type: string) => `${game} · ${story_type}`,
  reports_count: (count: number) =>
    `${String(count)} open reader ${count === 1 ? "report" : "reports"}`,
  reports_title: "Reader reports",
  was_published: "Published before: an edit adds a correction note.",
  ai_text_title: "AI text",
  ai_label: "AI-written from Liiga data",
  legend_label: "Claim marks",
  claim_status: {
    verified: "Verified",
    not_found: "Not in fact sheet",
    wrong: "Wrong",
  } satisfies Record<ClaimStatus, string>,
  claims_title: "Claims",
  claims_not_in_text: "Claims not found word for word in the text are listed here only.",
  cites: (fact_ids: string[]) =>
    fact_ids.length === 0 ? "No fact cited" : `Cites ${fact_ids.join(", ")}`,
  facts_title: "Fact sheet",
  fact_cited: "Cited",
  fact_source: (source: string) => `Source: ${source}`,
  no_facts: "The fact sheet is empty.",
  approve: "Approve",
  edit_and_approve: "Edit and approve",
  save_and_approve: "Save and approve",
  reject: "Reject",
  cancel: "Cancel",
  body_label: "Story text",
  edit_note_label: "What was wrong (optional)",
  reject_note_label: "Why it is rejected (optional)",
  working: "Saving…",
  check_failed: "The fact checker refused the text:",
  action_failed: (message: string) => `The action failed: ${message}`,
  action_done: (headline: string, status: EditorActionResult["status"]) => {
    const verb = {
      published: "Published",
      corrected: "Corrected and published",
      rejected: "Rejected",
    }[status];
    return `${verb}: ${headline}`;
  },
  select_story: "Select a story from the queue.",
};
