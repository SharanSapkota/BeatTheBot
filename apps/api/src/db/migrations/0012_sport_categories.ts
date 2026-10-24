import { sql, type Kysely } from "kysely";
import { add_updated_at_trigger, is_one_of, with_id, with_timestamps } from "../migration_helpers";

// Sport categories (step 8): hockey (real Liiga), football and basketball (admin-entered or demo).
// Adding a sport later = one entry in @voita_kone/scoring SPORTS + this CHECK in a new migration.
const SPORTS = ["hockey", "football", "basketball"];
// admin = a real match an admin entered in /admin (no API for that sport yet).
const DATA_SOURCES = ["liiga_api", "admin", "demo"];
const OLD_DATA_SOURCES = ["liiga_api", "demo"];
const SPORT_DATA_TABLES = ["teams", "players", "games", "game_events"];
const MARGIN_BANDS = ["1_5", "6_10", "11_plus"];

/** Reference leagues with fixed ids. Liiga's id is the default for existing and synced rows. */
const LIIGA_LEAGUE_ID = "00000000-0000-4000-8000-000000000001";
const LEAGUES = [
  { id: LIIGA_LEAGUE_ID, key: "liiga", name: "Liiga", sport: "hockey", data_source: "liiga_api" },
  {
    id: "00000000-0000-4000-8000-000000000002",
    key: "veikkausliiga",
    name: "Veikkausliiga",
    sport: "football",
    data_source: "admin",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    key: "korisliiga",
    name: "Korisliiga",
    sport: "basketball",
    data_source: "admin",
  },
];

const PRIVATE_LEAGUE_RENAMES: [string, string, string[]][] = [
  ["leagues", "private_leagues", ["pkey", "invite_code_key", "owner_user_id_fkey"]],
  [
    "league_members",
    "private_league_members",
    ["pkey", "league_id_fkey", "user_id_fkey", "league_id_user_id_unique"],
  ],
];

async function rename_tables(db: Kysely<unknown>, direction: "up" | "down"): Promise<void> {
  for (const [old_name, new_name, suffixes] of PRIVATE_LEAGUE_RENAMES) {
    const [from, to] = direction === "up" ? [old_name, new_name] : [new_name, old_name];
    await sql`ALTER TABLE ${sql.table(from)} RENAME TO ${sql.table(to)}`.execute(db);
    for (const suffix of suffixes) {
      await sql`ALTER TABLE ${sql.table(to)} RENAME CONSTRAINT ${sql.ref(`${from}_${suffix}`)} TO ${sql.ref(`${to}_${suffix}`)}`.execute(
        db,
      );
    }
  }
}

async function replace_data_source_check(
  db: Kysely<unknown>,
  values: readonly string[],
): Promise<void> {
  for (const table_name of SPORT_DATA_TABLES) {
    const constraint = `${table_name}_data_source_check`;
    await sql`ALTER TABLE ${sql.table(table_name)} DROP CONSTRAINT ${sql.ref(constraint)}`.execute(
      db,
    );
    await db.schema
      .alterTable(table_name)
      .addCheckConstraint(constraint, is_one_of("data_source", values))
      .execute();
  }
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // The old `leagues` (private leagues, never used) makes room for sports leagues.
  await rename_tables(db, "up");

  await db.schema
    .createTable("leagues")
    .$call(with_id)
    .addColumn("key", "text", (column) => column.notNull().unique())
    .addColumn("name", "text", (column) => column.notNull())
    .addColumn("sport", "text", (column) => column.notNull().check(is_one_of("sport", SPORTS)))
    .addColumn("country", "text", (column) => column.notNull().defaultTo("FI"))
    .addColumn("data_source", "text", (column) =>
      column.notNull().check(is_one_of("data_source", DATA_SOURCES)),
    )
    .$call(with_timestamps)
    // Lets teams and games reference (league_id, sport), so their sport always matches the league.
    .addUniqueConstraint("leagues_id_sport_unique", ["id", "sport"])
    .execute();
  await add_updated_at_trigger(db, "leagues");
  const league_rows = LEAGUES.map(
    (league) =>
      sql`(${league.id}::uuid, ${league.key}, ${league.name}, ${league.sport}, ${league.data_source})`,
  );
  await sql`INSERT INTO leagues (id, key, name, sport, data_source) VALUES ${sql.join(league_rows)}`.execute(
    db,
  );

  for (const table_name of ["teams", "games"]) {
    await db.schema
      .alterTable(table_name)
      .addColumn("sport", "text", (column) =>
        column.notNull().defaultTo("hockey").check(is_one_of("sport", SPORTS)),
      )
      .addColumn("league_id", "uuid", (column) => column.notNull().defaultTo(LIIGA_LEAGUE_ID))
      .execute();
    await db.schema
      .alterTable(table_name)
      .addForeignKeyConstraint(
        `${table_name}_league_sport_fkey`,
        ["league_id", "sport"],
        "leagues",
        ["id", "sport"],
      )
      .onDelete("restrict")
      .execute();
  }
  await db.schema
    .createIndex("games_sport_start_time_index")
    .on("games")
    .columns(["sport", "start_time"])
    .execute();

  // Basketball: the player with the most points, entered with the result.
  await db.schema
    .alterTable("games")
    .addColumn("top_scorer_player_id", "uuid", (column) =>
      column.references("players.id").onDelete("set null"),
    )
    .execute();

  await replace_data_source_check(db, DATA_SOURCES);

  // Football: a null winner is a draw pick. Basketball: no exact score, a margin band instead.
  await db.schema
    .alterTable("user_predictions")
    .alterColumn("predicted_winner_team_id", (column) => column.dropNotNull())
    .alterColumn("predicted_home_goals", (column) => column.dropNotNull())
    .alterColumn("predicted_away_goals", (column) => column.dropNotNull())
    .addColumn("predicted_margin_band", "text", (column) =>
      column.check(is_one_of("predicted_margin_band", MARGIN_BANDS)),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM user_predictions WHERE predicted_winner_team_id IS NULL OR predicted_home_goals IS NULL OR predicted_away_goals IS NULL`.execute(
    db,
  );
  await db.schema
    .alterTable("user_predictions")
    .dropColumn("predicted_margin_band")
    .alterColumn("predicted_winner_team_id", (column) => column.setNotNull())
    .alterColumn("predicted_home_goals", (column) => column.setNotNull())
    .alterColumn("predicted_away_goals", (column) => column.setNotNull())
    .execute();

  // Other sports' rows can't exist without their leagues.
  await sql`DELETE FROM games WHERE sport <> 'hockey' OR data_source = 'admin'`.execute(db);
  await sql`DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE sport <> 'hockey')`.execute(
    db,
  );
  await sql`DELETE FROM teams WHERE sport <> 'hockey'`.execute(db);
  await replace_data_source_check(db, OLD_DATA_SOURCES);

  await db.schema.alterTable("games").dropColumn("top_scorer_player_id").execute();
  await db.schema.dropIndex("games_sport_start_time_index").execute();
  for (const table_name of ["teams", "games"]) {
    await db.schema.alterTable(table_name).dropColumn("league_id").dropColumn("sport").execute();
  }
  await db.schema.dropTable("leagues").execute();
  await rename_tables(db, "down");
}
