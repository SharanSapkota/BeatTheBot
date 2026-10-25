import type { HighlightUploadStatus } from "@voita_kone/shared_types";
import type { UploadStatus } from "../../common/upload_dir";

/** Highlights added by a Kaleva editor. The form itself is step 12. */
export class HighlightsService {
  constructor(private readonly upload_status: UploadStatus) {}

  /** File uploads only when UPLOAD_DIR is set and writable; otherwise video URLs only. */
  get_upload_status(): HighlightUploadStatus {
    return { file_uploads: this.upload_status.file_uploads, reason: this.upload_status.reason };
  }
}
