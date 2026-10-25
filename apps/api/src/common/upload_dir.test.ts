import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { check_upload_dir, UPLOAD_REASONS } from "./upload_dir";

describe("check_upload_dir", () => {
  const folders: string[] = [];
  function new_folder(): string {
    const folder = mkdtempSync(path.join(tmpdir(), "voita_uploads_"));
    folders.push(folder);
    return folder;
  }

  afterEach(() => {
    for (const folder of folders.splice(0)) {
      chmodSync(folder, 0o700);
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("allows file uploads when the folder is writable (and creates it)", () => {
    const directory = path.join(new_folder(), "highlights");

    expect(check_upload_dir(directory, "production")).toEqual({
      file_uploads: true,
      reason: null,
      directory,
    });
  });

  it("allows video URLs only when UPLOAD_DIR is not set in production", () => {
    expect(check_upload_dir(undefined, "production")).toEqual({
      file_uploads: false,
      reason: UPLOAD_REASONS.not_set,
      directory: null,
    });
    expect(check_upload_dir("  ", "production").reason).toBe(UPLOAD_REASONS.not_set);
  });

  it.skipIf(process.getuid?.() === 0)(
    "allows video URLs only when the folder is not writable",
    () => {
      const folder = new_folder();
      chmodSync(folder, 0o500);

      const status = check_upload_dir(path.join(folder, "highlights"), "production");

      expect(status).toEqual({
        file_uploads: false,
        reason: UPLOAD_REASONS.not_writable,
        directory: null,
      });
      expect(status.reason).not.toContain(folder);
    },
  );
});
