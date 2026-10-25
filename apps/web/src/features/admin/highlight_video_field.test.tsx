import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HighlightVideoField } from "./highlight_video_field";

const REASON =
  "File uploads are off: UPLOAD_DIR is not set on the server. Paste a video link instead.";

describe("HighlightVideoField", () => {
  it("offers a file upload and a link when the server can store files", () => {
    render(
      <HighlightVideoField
        status={{ file_uploads: true, reason: null }}
        video_url=""
        on_video_url_change={vi.fn()}
        on_file_change={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Video file")).toBeInTheDocument();
    expect(screen.getByLabelText("Or paste a video link (https)")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("allows video links only and shows why when uploads are off", () => {
    const on_video_url_change = vi.fn();
    render(
      <HighlightVideoField
        status={{ file_uploads: false, reason: REASON }}
        video_url=""
        on_video_url_change={on_video_url_change}
        on_file_change={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Video file")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(`Video links only. ${REASON}`);
    fireEvent.change(screen.getByLabelText("Video link (https)"), {
      target: { value: "https://example.com/clip.mp4" },
    });
    expect(on_video_url_change).toHaveBeenCalledWith("https://example.com/clip.mp4");
  });

  it("shows only the link field while the status is loading", () => {
    render(
      <HighlightVideoField
        status={undefined}
        video_url=""
        on_video_url_change={vi.fn()}
        on_file_change={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Video file")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Video link (https)")).toBeInTheDocument();
  });
});
