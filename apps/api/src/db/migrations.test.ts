import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { migrations } from "./migrations";

describe("migrations", () => {
  it("lists every file in the migrations folder", () => {
    const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
    const file_names = readdirSync(folder)
      .filter((file_name) => file_name.endsWith(".ts"))
      .map((file_name) => file_name.replace(/\.ts$/, ""))
      .sort();

    expect(Object.keys(migrations).sort()).toEqual(file_names);
  });
});
