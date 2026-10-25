import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  editor_action_response_schema,
  editor_stories_response_schema,
  type EditorActionResult,
  type EditorStory,
} from "@voita_kone/shared_types";
import { api_get, api_request } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";

const QUEUE_KEY = "editor_stories";

export type QueueFilter = "all" | "yellow" | "red";

/** GET /admin/stories(?status=yellow|red): the 🟡 and 🔴 stories waiting for an editor. */
export function useEditorQueue(enabled: boolean, filter: QueueFilter = "all") {
  const token = useSessionToken();
  return useQuery({
    queryKey: [QUEUE_KEY, token, filter],
    enabled: enabled && token !== null,
    queryFn: async (): Promise<EditorStory[]> => {
      const path = filter === "all" ? "/admin/stories" : `/admin/stories?status=${filter}`;
      return (await api_get(path, editor_stories_response_schema)).data;
    },
  });
}

export type EditorAction =
  | { kind: "approve"; story_id: string }
  | { kind: "edit"; story_id: string; body: string; note?: string }
  | { kind: "reject"; story_id: string; note?: string };

/** approve / reject: POST …/:id/approve|reject; edit: PUT …/:id (the fact checker re-runs). */
async function send_editor_action(action: EditorAction): Promise<EditorActionResult> {
  const base = `/admin/stories/${encodeURIComponent(action.story_id)}`;
  if (action.kind === "edit") {
    const response = await api_request("PUT", base, editor_action_response_schema, {
      body: action.body,
      note: action.note,
    });
    return response.data;
  }
  const body = action.kind === "reject" ? { note: action.note } : undefined;
  const response = await api_request(
    "POST",
    `${base}/${action.kind}`,
    editor_action_response_schema,
    body,
  );
  return response.data;
}

/** Approve, edit (the fact checker re-runs) or reject a story; then reload the queue. */
export function useEditorAction() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: send_editor_action,
    onSuccess: () => query_client.invalidateQueries({ queryKey: [QUEUE_KEY] }),
  });
}
