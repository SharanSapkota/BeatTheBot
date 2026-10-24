import {
  build_fact_sheet,
  check_claims,
  find_escalation_words,
  find_strong_words,
  find_unknown_fact_ids,
  strip_fact_ids,
  type CheckResult,
  type FactSheet,
  type FailedClaim,
  type KnownName,
} from "@voita_kone/fact_checker";
import { model_config } from "@voita_kone/prediction_model";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { LlmClient } from "../../integrations/llm_client/llm_client";
import { to_season_data, type SeasonData } from "../ai_predictions/model_inputs";
import type { ModelInputsRepository } from "../ai_predictions/model_inputs_repository";
import {
  compute_season_facts,
  known_names_of,
  to_fact_sheet_input,
  type StoryGame,
} from "./fact_sheet_input";
import type { StoriesRepository } from "./stories_repository";
import { build_headline } from "./story_headline";
import {
  PROMPT_VERSION,
  STORY_MAX_TOKENS,
  STORY_TEMPERATURE,
  SYSTEM_PROMPT,
  build_story_prompt,
} from "./story_prompt";
import { decide_traffic_light, to_traffic_light, type TrafficLight } from "./traffic_light";

/** The first try plus at most 2 retries with the failed claims (docs/fact_checker.md). */
export const MAX_GENERATION_ATTEMPTS = 3;
export const STORY_LANGUAGE = "en";

export interface GenerationResult {
  status: "created" | "exists";
  story_id: string;
  traffic_light: TrafficLight;
}

export interface Draft {
  body: string;
  raw_output: string;
  model_name: string;
  check: CheckResult;
  attempts: number;
}

function game_not_final(game_id: string): AppError {
  return new AppError("GAME_NOT_FINAL", 409, `Game ${game_id} is not finished yet`);
}

/** Unknown fact ids count as failed claims: the model cited a fact that doesn't exist. */
function check_draft(
  raw: string,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): CheckResult {
  const body = strip_fact_ids(raw);
  const result = check_claims(body, sheet, known_names);
  const unknown_ids: FailedClaim[] = find_unknown_fact_ids(raw, sheet).map((fact_id) => ({
    claim: `[${fact_id}]`,
    type: "number",
    reason: "cites a fact that is not in the fact sheet",
  }));
  const failed_claims = [...result.failed_claims, ...unknown_ids];
  return { ...result, passed: failed_claims.length === 0, failed_claims };
}

/**
 * fact sheet → prompt → LLM → strip ids → check_claims → retry (max 2) → traffic light.
 * Pure apart from the LLM call, so the retry rules are tested with a scripted client.
 */
export async function write_checked_draft(
  llm: LlmClient,
  sheet: FactSheet,
  known_names: readonly KnownName[],
): Promise<Draft> {
  let failed: FailedClaim[] = [];
  let draft: Draft | undefined;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const response = await llm.complete({
      system: SYSTEM_PROMPT,
      prompt: build_story_prompt(sheet, failed),
      temperature: STORY_TEMPERATURE,
      max_tokens: STORY_MAX_TOKENS,
    });
    const check = check_draft(response.text, sheet, known_names);
    draft = {
      body: strip_fact_ids(response.text),
      raw_output: response.text,
      model_name: response.model_name,
      check,
      attempts: attempt,
    };
    if (check.passed) {
      break;
    }
    failed = check.failed_claims;
  }
  if (!draft) {
    throw new Error("No generation attempt ran");
  }
  return draft;
}

/** Writes the "what it means" story of a finished game and queues it for the editor. */
export class StoryGenerationService {
  constructor(
    private readonly repository: StoriesRepository,
    private readonly inputs_repository: ModelInputsRepository,
    private readonly llm: LlmClient,
    private readonly clock: Clock,
    /** Season simulations per odds estimate (fewer in tests). */
    private readonly season_simulations: number = model_config.season_simulations,
  ) {}

  async generate(game_id: string): Promise<GenerationResult> {
    const existing = await this.repository.find_story(game_id, "what_it_means", STORY_LANGUAGE);
    if (existing) {
      return {
        status: "exists",
        story_id: existing.id,
        traffic_light: to_traffic_light(existing.traffic_light),
      };
    }
    const game = await this.repository.find_final_game(game_id);
    if (!game) {
      throw game_not_final(game_id);
    }
    const data = await this.load_season(game_id);
    const sheet = build_fact_sheet(
      to_fact_sheet_input(
        game,
        await this.repository.list_goals(game_id),
        data
          ? compute_season_facts(data, game, this.season_simulations)
          : { standings: [], odds: [], next_games: [] },
        this.clock(),
      ),
    );
    const known_names = data ? known_names_of(data) : names_of_game(game);
    const fact_sheet_id = await this.repository.save_fact_sheet(sheet);

    const headline = build_headline(sheet);
    const draft = await write_checked_draft(this.llm, sheet, known_names);
    const headline_check = check_claims(headline, sheet, known_names);
    const escalation_words = find_escalation_words(draft.body);
    const check_passed = draft.check.passed && headline_check.passed;
    const traffic_light = decide_traffic_light({ check_passed, escalation_words });

    const story_id = await this.repository.insert_story({
      game_id,
      story_type: "what_it_means",
      language: STORY_LANGUAGE,
      headline,
      body: draft.body,
      fact_sheet_id,
      traffic_light,
      check_result: {
        ...draft.check,
        passed: check_passed,
        failed_claims: [...draft.check.failed_claims, ...headline_check.failed_claims],
        escalation_words,
        strong_words: find_strong_words(draft.body),
      },
      generation_attempts: draft.attempts,
      prompt_version: PROMPT_VERSION,
      model_name: draft.model_name,
      raw_output: draft.raw_output,
    });
    return { status: "created", story_id, traffic_light };
  }

  /** The game's season (real Liiga games only), or undefined for a demo fill-in. */
  private async load_season(game_id: string): Promise<SeasonData | undefined> {
    const season =
      (await this.inputs_repository.find_game_season(game_id)) ??
      (await this.inputs_repository.find_current_season());
    if (season === undefined) {
      return undefined;
    }
    return to_season_data(await this.inputs_repository.load_season(season));
  }
}

function names_of_game(game: StoryGame): KnownName[] {
  return [
    { name: game.home_team, kind: "team" },
    { name: game.away_team, kind: "team" },
  ];
}
