import type { RequestHandler } from "express";
import type { ApiSuccess, HealthData } from "@voita_kone/shared_types";
import type { HealthService } from "./health_service";

export class HealthController {
  constructor(private readonly health_service: HealthService) {}

  get_health: RequestHandler = (_req, res) => {
    const response: ApiSuccess<HealthData> = { data: this.health_service.get_health() };
    res.json(response);
  };
}
