import { accessSync, constants, mkdirSync } from "node:fs";
import path from "node:path";

/** Whether the highlight form may take video files, or video URLs only (and why). */
export interface UploadStatus {
  file_uploads: boolean;
  /** Shown to editors when file uploads are off. Never contains the folder path. */
  reason: string | null;
  /** The absolute upload folder when file uploads are on. */
  directory: string | null;
}

/** Outside production an unset UPLOAD_DIR means ./uploads (in .gitignore). */
const DEV_UPLOAD_DIR = "uploads";

export const UPLOAD_REASONS = {
  not_set: "File uploads are off: UPLOAD_DIR is not set on the server. Paste a video link instead.",
  not_writable:
    "File uploads are off: the upload folder on the server is not writable. Paste a video link instead.",
} as const;

function is_writable(directory: string): boolean {
  try {
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Checked once on API start. Creates the folder when it is missing. */
export function check_upload_dir(
  upload_dir: string | undefined,
  node_env: "development" | "test" | "production",
): UploadStatus {
  const configured = upload_dir?.trim() || (node_env === "production" ? "" : DEV_UPLOAD_DIR);
  if (!configured) {
    return { file_uploads: false, reason: UPLOAD_REASONS.not_set, directory: null };
  }
  const directory = path.resolve(configured);
  if (!is_writable(directory)) {
    return { file_uploads: false, reason: UPLOAD_REASONS.not_writable, directory: null };
  }
  return { file_uploads: true, reason: null, directory };
}
