import { replay_moment_schema } from "@voita_kone/shared_types";
import { z } from "zod";

// Request validation.

export const game_params_schema = z.object({ game_id: z.string() });

export const demo_query_schema = z.object({ moment: replay_moment_schema });
