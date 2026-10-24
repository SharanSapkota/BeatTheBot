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

/** GET /editor/stories: the 🟡 and 🔴 stories waiting for an editor. */
export function useEditorQueue(enabled: boolean) {
  const token = useSessionToken();
  return useQuery({
    queryKey: [QUEUE_KEY, token],
    enabled: enabled && token !== null,
    queryFn: async (): Promise<EditorStory[]> => {
      const response = await api_get("/editor/stories", editor_stories_response_schema);
      return response.data;
    },
  });
}

export type EditorAction =
  | { kind: "approve"; story_id: string }
  | { kind: "edit"; story_id: string; body: string; note?: string }
  | { kind: "reject"; story_id: string; note?: string };

function story_path(story_id: string, action: EditorAction["kind"]): string {
  return `/editor/stories/${encodeURIComponent(story_id)}/${action}`;
}

async function send_editor_action(action: EditorAction): Promise<EditorActionResult> {
  const path = story_path(action.story_id, action.kind);
  const body =
    action.kind === "approve"
      ? undefined
      : action.kind === "edit"
        ? { body: action.body, note: action.note }
        : { note: action.note };
  const response = await api_request("POST", path, editor_action_response_schema, body);
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
