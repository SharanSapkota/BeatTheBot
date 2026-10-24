import { run_role_script } from "./set_user_role";

// Usage: pnpm --filter @voita_kone/api make:admin -- --user_id <id>
// Gives a user the admin role (the /admin page). The user id is shown on /admin.
run_role_script({ role: "admin", action: "user.make_admin", script_name: "make:admin" });
