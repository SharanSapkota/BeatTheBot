import { Navigate } from "react-router";

/** /editor (old link): the story queue is now the Stories tab of /admin. */
export function EditorPage() {
  return <Navigate to="/admin?tab=stories" replace />;
}
