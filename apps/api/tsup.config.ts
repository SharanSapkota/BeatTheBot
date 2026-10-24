import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  // Internal packages ship TypeScript source, so they are bundled into the API build.
  noExternal: [/^@voita_kone\//],
});
