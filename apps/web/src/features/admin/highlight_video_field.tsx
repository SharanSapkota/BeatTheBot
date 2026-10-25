import type { HighlightUploadStatus } from "@voita_kone/shared_types";
import { admin_copy } from "./copy";
import styles from "./admin_form.module.css";

interface HighlightVideoFieldProps {
  /** From useHighlightUploadStatus(); undefined while loading (then links only). */
  status: HighlightUploadStatus | undefined;
  video_url: string;
  on_video_url_change: (video_url: string) => void;
  on_file_change: (file: File | null) => void;
}

/**
 * The highlight form's video source. A file upload only when the server has a writable
 * UPLOAD_DIR; otherwise a video link only, with the server's reason.
 */
export function HighlightVideoField({
  status,
  video_url,
  on_video_url_change,
  on_file_change,
}: HighlightVideoFieldProps) {
  const file_uploads = status?.file_uploads === true;
  return (
    <>
      {file_uploads ? (
        <label className={styles.field}>
          {admin_copy.field_video_file}
          <input
            type="file"
            accept="video/*"
            onChange={(event) => {
              on_file_change(event.target.files?.[0] ?? null);
            }}
          />
        </label>
      ) : null}
      <label className={styles.field}>
        {file_uploads ? admin_copy.field_video_url_or : admin_copy.field_video_url}
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={video_url}
          onChange={(event) => {
            on_video_url_change(event.target.value);
          }}
        />
      </label>
      {status && !status.file_uploads ? (
        <p className={styles.hint} role="note">
          <strong>{admin_copy.video_url_only}.</strong> {status.reason}
        </p>
      ) : null}
    </>
  );
}
