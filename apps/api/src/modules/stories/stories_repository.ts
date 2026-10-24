import type { FactSheet } from "@voita_kone/fact_checker";
import { sql } from "kysely";
import type { Database } from "../../db/kysely";
import { to_ended_in } from "../../jobs/score_predictions_repository";
import type { StoryGame, StoryGoalRow } from "./fact_sheet_input";
import type { TrafficLight } from "./traffic_light";

export type StoryType = "what_it_means" | "ai_pick_reasons" | "recap";

export interface NewStory {
  game_id: string;
  story_type: StoryType;
  language: string;
  headline: string;
  body: string;
  fact_sheet_id: string;
  traffic_light: TrafficLight;
  check_result: unknown;
  generation_attempts: number;
  prompt_version: string;
  model_name: string;
  raw_output: string;
}

export interface StoryRow {
  id: string;
  game_id: string;
  status: string;
  traffic_light: string;
}

export interface PublishedStoryRow {
  id: string;
  headline: string | null;
  body: string;
  label_text: string | null;
}

export interface StoriesRepository {
  /** A finished game with a final score, or undefined. */
  find_final_game(game_id: string): Promise<StoryGame | undefined>;
  /** Goals in time order, with the scorer's full name when known. */
  list_goals(game_id: string): Promise<StoryGoalRow[]>;
  /** Finished games since `since` that have no story of this type and language yet. */
  list_games_without_story(since: Date, story_type: StoryType, language: string): Promise<string[]>;
  find_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<StoryRow | undefined>;
  save_fact_sheet(sheet: FactSheet): Promise<string>;
  insert_story(story: NewStory): Promise<string>;
  find_published_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<PublishedStoryRow | undefined>;
  find_story_by_id(story_id: string): Promise<StoryRow | undefined>;
  /** The first editor (MVP: the seeded Kaleva sports desk account). */
  find_editor_id(): Promise<string | undefined>;
  /** Records the editor's approval and publishes the story, in one transaction. */
  publish_story(
    story_id: string,
    editor_user_id: string,
    label_text: string,
    at: Date,
  ): Promise<void>;
}

function to_json(value: unknown): string {
  return JSON.stringify(value);
}

export class KyselyStoriesRepository implements StoriesRepository {
  constructor(private readonly db: Database) {}

  async find_final_game(game_id: string): Promise<StoryGame | undefined> {
    const row = await this.db
      .selectFrom("games")
      .innerJoin("teams as home", "home.id", "games.home_team_id")
      .innerJoin("teams as away", "away.id", "games.away_team_id")
      .select([
        "games.id",
        "games.start_time",
        "games.home_team_id",
        "games.away_team_id",
        "home.name as home_team",
        "away.name as away_team",
        "games.home_goals",
        "games.away_goals",
        "games.ended_in",
      ])
      .where("games.id", "=", game_id)
      .where("games.status", "=", "final")
      .executeTakeFirst();
    const ended_in = to_ended_in(row?.ended_in ?? null);
    if (!row || row.home_goals === null || row.away_goals === null || ended_in === null) {
      return undefined;
    }
    return { ...row, home_goals: row.home_goals, away_goals: row.away_goals, ended_in };
  }

  list_goals(game_id: string): Promise<StoryGoalRow[]> {
    return this.db
      .selectFrom("game_events")
      .leftJoin("players", "players.id", "game_events.player_id")
      .select([
        "game_events.team_id",
        "game_events.period",
        "game_events.game_time_seconds",
        sql<string | null>`players.first_name || ' ' || players.last_name`.as("player_name"),
      ])
      .where("game_events.game_id", "=", game_id)
      .where("game_events.event_type", "=", "goal")
      .where("game_events.team_id", "is not", null)
      .orderBy("game_events.period")
      .orderBy("game_events.game_time_seconds")
      .execute()
      .then((rows) =>
        rows.flatMap((row) => (row.team_id === null ? [] : [{ ...row, team_id: row.team_id }])),
      );
  }

  async list_games_without_story(
    since: Date,
    story_type: StoryType,
    language: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectFrom("games")
      .select("games.id")
      .where("games.status", "=", "final")
      .where("games.start_time", ">=", since)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("stories")
              .select("stories.id")
              .whereRef("stories.game_id", "=", "games.id")
              .where("stories.story_type", "=", story_type)
              .where("stories.language", "=", language),
          ),
        ),
      )
      .orderBy("games.start_time")
      .execute();
    return rows.map((row) => row.id);
  }

  find_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<StoryRow | undefined> {
    return this.db
      .selectFrom("stories")
      .select(["id", "game_id", "status", "traffic_light"])
      .where("game_id", "=", game_id)
      .where("story_type", "=", story_type)
      .where("language", "=", language)
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  async save_fact_sheet(sheet: FactSheet): Promise<string> {
    const row = await this.db
      .insertInto("fact_sheets")
      .values({ game_id: sheet.game_id, facts: to_json(sheet.facts), built_at: sheet.built_at })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async insert_story(story: NewStory): Promise<string> {
    const row = await this.db
      .insertInto("stories")
      .values({
        ...story,
        status: "in_review",
        check_result: to_json(story.check_result),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  find_published_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<PublishedStoryRow | undefined> {
    return this.db
      .selectFrom("stories")
      .select(["id", "headline", "body", "label_text"])
      .where("game_id", "=", game_id)
      .where("story_type", "=", story_type)
      .where("language", "=", language)
      .where("status", "in", ["published", "corrected"])
      .orderBy("published_at", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  find_story_by_id(story_id: string): Promise<StoryRow | undefined> {
    return this.db
      .selectFrom("stories")
      .select(["id", "game_id", "status", "traffic_light"])
      .where("id", "=", story_id)
      .executeTakeFirst();
  }

  async find_editor_id(): Promise<string | undefined> {
    const row = await this.db
      .selectFrom("users")
      .select("id")
      .where("role", "in", ["editor", "admin"])
      .where("deleted_at", "is", null)
      .orderBy("created_at")
      .limit(1)
      .executeTakeFirst();
    return row?.id;
  }

  async publish_story(
    story_id: string,
    editor_user_id: string,
    label_text: string,
    at: Date,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("story_reviews")
        .values({ story_id, editor_user_id, decision: "approve", reviewed_at: at })
        .execute();
      await trx
        .updateTable("stories")
        .set({ status: "published", published_at: at, label_text })
        .where("id", "=", story_id)
        .execute();
    });
  }
}
