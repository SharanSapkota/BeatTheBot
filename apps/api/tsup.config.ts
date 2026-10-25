import { defineConfig } from "tsup";

export default defineConfig({
  // The server, plus the scripts a production shell needs (no tsx there):
  // node dist/scripts/<name>.js, or the *:prod package scripts.
  entry: {
    server: "src/server.ts",
    "scripts/migrate": "src/db/scripts/migrate.ts",
    "scripts/setup_prod": "src/db/scripts/setup_prod.ts",
    "scripts/make_admin": "src/jobs/scripts/make_admin.ts",
    "scripts/make_editor": "src/jobs/scripts/make_editor.ts",
  },
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  // Internal packages ship TypeScript source, so they are bundled into the API build.
  noExternal: [/^@voita_kone\//],
});
