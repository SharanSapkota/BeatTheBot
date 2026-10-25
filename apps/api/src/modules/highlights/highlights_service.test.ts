import { describe, expect, it } from "vitest";
import { UPLOAD_REASONS } from "../../common/upload_dir";
import { HighlightsService } from "./highlights_service";

describe("HighlightsService", () => {
  it("allows file uploads when the upload folder works", () => {
    const service = new HighlightsService({
      file_uploads: true,
      reason: null,
      directory: "/data/uploads",
    });

    expect(service.get_upload_status()).toEqual({ file_uploads: true, reason: null });
  });

  it("gives video URLs only with the reason, without the folder path", () => {
    const service = new HighlightsService({
      file_uploads: false,
      reason: UPLOAD_REASONS.not_writable,
      directory: null,
    });

    expect(service.get_upload_status()).toEqual({
      file_uploads: false,
      reason: UPLOAD_REASONS.not_writable,
    });
  });
});
