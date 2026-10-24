import type { HealthData } from "@voita_kone/shared_types";
import type { Clock } from "../../common/clock";

export class HealthService {
  constructor(private readonly clock: Clock) {}

  get_health(): HealthData {
    return { status: "ok", time: this.clock().toISOString() };
  }
}
