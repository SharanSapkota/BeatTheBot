import { game_state_schema } from "@voita_kone/shared_types";
import { z } from "zod";

// Request validation. Dates stay strings here; the service checks them (INVALID_DATE).

export const game_day_params_schema = z.object({ date: z.string() });

export const game_params_schema = z.object({ game_id: z.string() });

export const game_list_query_schema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  team_id: z.uuid().optional(),
  state: game_state_schema.optional(),
});
