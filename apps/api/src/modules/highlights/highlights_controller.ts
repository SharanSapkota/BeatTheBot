import type { RequestHandler } from "express";
import type { ApiSuccess, HighlightUploadStatus } from "@voita_kone/shared_types";
import { require_role } from "../auth/auth_context";
import type { HighlightsService } from "./highlights_service";

const EDITOR_ROLES = ["editor", "admin"] as const;

/** 401 anonymous, 403 for users. */
export class HighlightsController {
  constructor(private readonly highlights_service: HighlightsService) {}

  get_upload_status: RequestHandler = (req, res) => {
    require_role(req, EDITOR_ROLES);
    const response: ApiSuccess<HighlightUploadStatus> = {
      data: this.highlights_service.get_upload_status(),
    };
    res.set("Cache-Control", "no-store").json(response);
  };
}
