import type { Fact, FactSheet, KnownName, PreviewMeeting } from "@voita_kone/fact_checker";
import { sql } from "kysely";
import { z } from "zod";
import { to_helsinki_date } from "../../common/helsinki_date";
import { write_audit } from "../../db/audit_log";
import type { Database } from "../../db/kysely";
import { to_ended_in } from "../../jobs/score_predictions_repository";
import type { StoryGoalRow } from "./fact_sheet_input";
import type { TrafficLight } from "./traffic_light";

export type StoryType = "preview" | "summary";
export type StorySource = "llm" | "template";

/** A game as story generation needs it (any state). */
export interface StoryGameRow {
  id: string;
  season: string;
  start_time: Date;
  status: string;
  data_source: string;
  home_team_id: string;
  away_team_id: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  ended_in: "regulation" | "overtime" | "shootout" | null;
}

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
  source: StorySource;
  /** Set for 🟢 stories: published at once with this label. */
  publish: { label_text: string; at: Date } | null;
}

/** Everything about one story, for readers, reports and the editor. */
export interface StoryRow {
  id: string;
  game_id: string;
  story_type: string;
  headline: string | null;
  body: string;
  status: string;
  traffic_light: string;
  source: string;
  label_text: string | null;
  check_result: unknown;
  published_at: Date | null;
  corrected_at: Date | null;
  correction_note: string | null;
  created_at: Date;
  fact_sheet_id: string;
  facts: Fact[];
}

export interface QueueStoryRow extends StoryRow {
  home_team: string;
  away_team: string;
  start_time: Date;
  reports: { reason: string; created_at: Date }[];
}

export interface PublishChange {
  story_id: string;
  editor_user_id: string;
  label_text: string;
  at: Date;
  /** "edit": the editor's text replaces the body (checked again). */
  edit: {
    body: string;
    check_result: unknown;
    traffic_light: TrafficLight;
    /** Set when the story had been published before: shown as "Corrected HH:MM". */
    correction_note: string | null;
  } | null;
}

export interface StoriesRepository {
  find_game(game_id: string): Promise<StoryGameRow | undefined>;
  /** Goals in time order, with the scorer's full name when known. */
  list_goals(game_id: string): Promise<StoryGoalRow[]>;
  /** The two teams' last finished meetings before `before` (any season), newest first. */
  list_meetings(
    home_team_id: string,
    away_team_id: string,
    before: Date,
    limit: number,
  ): Promise<PreviewMeeting[]>;
  /** Every team and player name (a real name not in a fact sheet fails the check). */
  list_known_names(): Promise<KnownName[]>;
  /**
   * Real Liiga games that need a preview: starting in the next 7 days or finished in the last
   * 7 days without one, or starting within 2 hours with a preview built before that.
   */
  list_games_needing_preview(
    now: Date,
    window_days: number,
    refresh_hours: number,
  ): Promise<string[]>;
  /** Finished games since `since` without a story of this type. */
  list_games_without_story(since: Date, story_type: StoryType, language: string): Promise<string[]>;
  save_fact_sheet(sheet: FactSheet): Promise<string>;
  insert_story(story: NewStory): Promise<string>;
  find_published_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<StoryRow | undefined>;
  find_story(story_id: string): Promise<StoryRow | undefined>;
  /** Stories waiting for an editor (🟡 and 🔴), newest first. */
  list_queue(): Promise<QueueStoryRow[]>;
  /** A reader report: the story goes back to 🟡 in review, with the report and an audit entry. */
  report_story(
    story_id: string,
    reason: string,
    reported_by: string | null,
    at: Date,
  ): Promise<void>;
  publish_story(change: PublishChange): Promise<void>;
  reject_story(
    story_id: string,
    editor_user_id: string,
    note: string | null,
    at: Date,
  ): Promise<void>;
}

const fact_schema = z.custom<Fact>(
  (value) => typeof value === "object" && value !== null && "fact_id" in value && "type" in value,
);

function to_json(value: unknown): string {
  return JSON.stringify(value);
}

export class KyselyStoriesRepository implements StoriesRepository {
  constructor(private readonly db: Database) {}

  async find_game(game_id: string): Promise<StoryGameRow | undefined> {
    const row = await this.db
      .selectFrom("games")
      .innerJoin("teams as home", "home.id", "games.home_team_id")
      .innerJoin("teams as away", "away.id", "games.away_team_id")
      .select([
        "games.id",
        "games.season",
        "games.start_time",
        "games.status",
        "games.data_source",
        "games.home_team_id",
        "games.away_team_id",
        "home.name as home_team",
        "away.name as away_team",
        "games.home_goals",
        "games.away_goals",
        "games.ended_in",
      ])
      .where("games.id", "=", game_id)
      .executeTakeFirst();
    return row ? { ...row, ended_in: to_ended_in(row.ended_in) } : undefined;
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

  async list_meetings(
    home_team_id: string,
    away_team_id: string,
    before: Date,
    limit: number,
  ): Promise<PreviewMeeting[]> {
    const rows = await this.db
      .selectFrom("games")
      .innerJoin("teams as home", "home.id", "games.home_team_id")
      .innerJoin("teams as away", "away.id", "games.away_team_id")
      .select([
        "games.start_time",
        "home.name as home_team",
        "away.name as away_team",
        "games.home_goals",
        "games.away_goals",
        "games.ended_in",
      ])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("games.home_team_id", "=", home_team_id),
            eb("games.away_team_id", "=", away_team_id),
          ]),
          eb.and([
            eb("games.home_team_id", "=", away_team_id),
            eb("games.away_team_id", "=", home_team_id),
          ]),
        ]),
      )
      .where("games.status", "=", "final")
      .where("games.data_source", "=", "liiga_api")
      .where("games.start_time", "<", before)
      .orderBy("games.start_time", "desc")
      .limit(limit)
      .execute();
    return rows.flatMap((row) => {
      const ended_in = to_ended_in(row.ended_in);
      return row.home_goals === null || row.away_goals === null || ended_in === null
        ? []
        : [
            {
              home_team: row.home_team,
              away_team: row.away_team,
              date: to_helsinki_date(row.start_time),
              home_goals: row.home_goals,
              away_goals: row.away_goals,
              ended_in,
            },
          ];
    });
  }

  async list_known_names(): Promise<KnownName[]> {
    const [teams, players] = await Promise.all([
      this.db.selectFrom("teams").select("name").execute(),
      this.db
        .selectFrom("players")
        .select(sql<string>`first_name || ' ' || last_name`.as("name"))
        .execute(),
    ]);
    return [
      ...teams.map((team) => ({ name: team.name, kind: "team" as const })),
      ...players.map((player) => ({ name: player.name, kind: "player" as const })),
    ];
  }

  async list_games_needing_preview(
    now: Date,
    window_days: number,
    refresh_hours: number,
  ): Promise<string[]> {
    const day_ms = 24 * 60 * 60 * 1000;
    const from = new Date(now.getTime() - window_days * day_ms);
    const to = new Date(now.getTime() + window_days * day_ms);
    const refresh_ms = refresh_hours * 60 * 60 * 1000;
    const rows = await this.db
      .selectFrom("games")
      .select(["games.id", "games.start_time", "games.status"])
      .select((eb) =>
        eb
          .selectFrom("stories")
          .innerJoin("fact_sheets", "fact_sheets.id", "stories.fact_sheet_id")
          .select(sql<Date>`max(fact_sheets.built_at)`.as("built_at"))
          .whereRef("stories.game_id", "=", "games.id")
          .where("stories.story_type", "=", "preview")
          .as("latest_preview_built_at"),
      )
      .where("games.data_source", "=", "liiga_api")
      .where("games.start_time", ">=", from)
      .where("games.start_time", "<=", to)
      .where("games.status", "in", ["scheduled", "final"])
      .orderBy("games.start_time")
      .execute();
    return rows
      .filter((row) => {
        if (row.latest_preview_built_at === null) {
          return true;
        }
        const refresh_from = row.start_time.getTime() - refresh_ms;
        return (
          row.status === "scheduled" &&
          now.getTime() >= refresh_from &&
          now < row.start_time &&
          new Date(row.latest_preview_built_at).getTime() < refresh_from
        );
      })
      .map((row) => row.id);
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

  async save_fact_sheet(sheet: FactSheet): Promise<string> {
    const row = await this.db
      .insertInto("fact_sheets")
      .values({
        game_id: sheet.game_id,
        facts: to_json(sheet.facts),
        built_at: sheet.built_at,
        kind: sheet.kind ?? "summary",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async insert_story(story: NewStory): Promise<string> {
    const { publish, check_result, ...values } = story;
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto("stories")
        .values({
          ...values,
          check_result: to_json(check_result),
          status: publish ? "published" : "in_review",
          published_at: publish?.at ?? null,
          label_text: publish?.label_text ?? null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      if (publish) {
        await write_audit(trx, {
          actor_user_id: null,
          action: "story.auto_publish",
          target_type: "story",
          target_id: row.id,
          details: { traffic_light: story.traffic_light, source: story.source },
          at: publish.at,
        });
      }
      return row.id;
    });
  }

  private select_stories() {
    return this.db
      .selectFrom("stories")
      .innerJoin("fact_sheets", "fact_sheets.id", "stories.fact_sheet_id")
      .select([
        "stories.id",
        "stories.game_id",
        "stories.story_type",
        "stories.headline",
        "stories.body",
        "stories.status",
        "stories.traffic_light",
        "stories.source",
        "stories.label_text",
        "stories.check_result",
        "stories.published_at",
        "stories.corrected_at",
        "stories.correction_note",
        "stories.created_at",
        "stories.fact_sheet_id",
        "fact_sheets.facts",
      ]);
  }

  private to_story_row<T extends { facts: unknown }>(row: T): Omit<T, "facts"> & { facts: Fact[] } {
    return { ...row, facts: z.array(fact_schema).parse(row.facts) };
  }

  async find_published_story(
    game_id: string,
    story_type: StoryType,
    language: string,
  ): Promise<StoryRow | undefined> {
    const row = await this.select_stories()
      .where("stories.game_id", "=", game_id)
      .where("stories.story_type", "=", story_type)
      .where("stories.language", "=", language)
      .where("stories.status", "in", ["published", "corrected"])
      .orderBy("stories.published_at", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ? this.to_story_row(row) : undefined;
  }

  async find_story(story_id: string): Promise<StoryRow | undefined> {
    const row = await this.select_stories().where("stories.id", "=", story_id).executeTakeFirst();
    return row ? this.to_story_row(row) : undefined;
  }

  async list_queue(): Promise<QueueStoryRow[]> {
    const rows = await this.select_stories()
      .innerJoin("games", "games.id", "stories.game_id")
      .innerJoin("teams as home", "home.id", "games.home_team_id")
      .innerJoin("teams as away", "away.id", "games.away_team_id")
      .select(["home.name as home_team", "away.name as away_team", "games.start_time"])
      .where("stories.status", "=", "in_review")
      .orderBy("stories.created_at", "desc")
      .execute();
    const ids = rows.map((row) => row.id);
    const reports =
      ids.length === 0
        ? []
        : await this.db
            .selectFrom("error_reports")
            .select(["target_id", "description", "created_at"])
            .where("target_type", "=", "story")
            .where("status", "=", "open")
            .where("target_id", "in", ids)
            .orderBy("created_at")
            .execute();
    return rows.map((row) => ({
      ...this.to_story_row(row),
      reports: reports
        .filter((report) => report.target_id === row.id)
        .map((report) => ({ reason: report.description, created_at: report.created_at })),
    }));
  }

  async report_story(
    story_id: string,
    reason: string,
    reported_by: string | null,
    at: Date,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("error_reports")
        .values({ target_type: "story", target_id: story_id, reported_by, description: reason })
        .execute();
      await trx
        .updateTable("stories")
        .set({ status: "in_review", traffic_light: "yellow" })
        .where("id", "=", story_id)
        .where("status", "in", ["published", "corrected"])
        .execute();
      await write_audit(trx, {
        actor_user_id: reported_by,
        action: "story.report",
        target_type: "story",
        target_id: story_id,
        details: { reason },
        at,
      });
    });
  }

  async publish_story(change: PublishChange): Promise<void> {
    const { story_id, editor_user_id, label_text, at, edit } = change;
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("story_reviews")
        .values({
          story_id,
          editor_user_id,
          decision: edit ? "edit" : "approve",
          edited_body: edit?.body ?? null,
          reviewed_at: at,
        })
        .execute();
      await trx
        .updateTable("stories")
        .set({
          status: edit?.correction_note ? "corrected" : "published",
          published_at: at,
          label_text,
          ...(edit
            ? {
                body: edit.body,
                check_result: to_json(edit.check_result),
                traffic_light: edit.traffic_light,
              }
            : {}),
          ...(edit?.correction_note
            ? { corrected_at: at, correction_note: edit.correction_note }
            : {}),
        })
        .where("id", "=", story_id)
        .execute();
      if (edit?.correction_note) {
        await trx
          .insertInto("corrections")
          .values({
            target_type: "story",
            target_id: story_id,
            what_was_wrong: edit.correction_note,
            corrected_at: at,
            corrected_by: editor_user_id,
          })
          .execute();
      }
      await trx
        .updateTable("error_reports")
        .set({ status: "fixed", fixed_at: at })
        .where("target_type", "=", "story")
        .where("target_id", "=", story_id)
        .where("status", "=", "open")
        .execute();
      await write_audit(trx, {
        actor_user_id: editor_user_id,
        action: edit ? "story.edit" : "story.approve",
        target_type: "story",
        target_id: story_id,
        details: edit
          ? { traffic_light: edit.traffic_light, correction_note: edit.correction_note }
          : {},
        at,
      });
    });
  }

  async reject_story(
    story_id: string,
    editor_user_id: string,
    note: string | null,
    at: Date,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("story_reviews")
        .values({ story_id, editor_user_id, decision: "reject", notes: note, reviewed_at: at })
        .execute();
      await trx
        .updateTable("stories")
        .set({ status: "rejected" })
        .where("id", "=", story_id)
        .execute();
      await trx
        .updateTable("error_reports")
        .set({ status: "fixed", fixed_at: at })
        .where("target_type", "=", "story")
        .where("target_id", "=", story_id)
        .where("status", "=", "open")
        .execute();
      await write_audit(trx, {
        actor_user_id: editor_user_id,
        action: "story.reject",
        target_type: "story",
        target_id: story_id,
        details: { note },
        at,
      });
    });
  }
}
