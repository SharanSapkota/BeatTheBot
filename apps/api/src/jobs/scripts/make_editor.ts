import { run_role_script } from "./set_user_role";

// Usage: pnpm --filter @voita_kone/api make:editor -- --user_id <id>
// Gives a user the editor role (the /editor page). The user id is shown on /editor.
run_role_script({ role: "editor", action: "user.make_editor", script_name: "make:editor" });
