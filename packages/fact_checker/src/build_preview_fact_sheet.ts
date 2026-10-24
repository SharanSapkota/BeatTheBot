import type { EndedIn, Fact, FactSheet, FactSource, StakeKind } from "./fact_sheet";

// The preview fact sheet of an upcoming game, from data the API has already loaded and computed
// as of puck drop (form, meetings, records, table, model numbers). Pure; never calls the LLM.

export interface PreviewTeamFacts {
  team: string;
  /** Last 5 finished games, oldest first: "W" or "L". */
  form: string;
  /** Home team: home record; away team: away record (this season). */
  venue_record: { wins: number; losses: number };
  table: { rank: number; points: number; games_played: number } | null;
  /** The team's top scorer in its last 5 games (null if nobody scored). */
  top_scorer: { player: string; goals: number } | null;
  /** The biggest stake: the team's odds if it wins vs loses. */
  stake: { kind: StakeKind; if_win: number; if_loss: number } | null;
}

export interface PreviewMeeting {
  home_team: string;
  away_team: string;
  date: string;
  home_goals: number;
  away_goals: number;
  ended_in: EndedIn;
}

export interface PreviewFactSheetInput {
  game_id: string;
  built_at: string;
  home: PreviewTeamFacts;
  away: PreviewTeamFacts;
  /** Last meetings, newest first (at most 5 are used). */
  meetings: readonly PreviewMeeting[];
  win_chance: { home_win: number; away_win: number } | null;
  /** e.g. "prediction_model:poisson_mc_v1". */
  model_source: FactSource;
}

export const FORM_GAMES = 5;
export const MEETING_COUNT = 5;

function team_facts(
  team: PreviewTeamFacts,
  venue: "home" | "away",
  input: PreviewFactSheetInput,
  push: (fact: Omit<Fact, "fact_id">) => void,
): void {
  if (team.form.length > 0) {
    push({
      type: "form",
      value: {
        team: team.team,
        results: team.form,
        wins: [...team.form].filter((result) => result === "W").length,
        losses: [...team.form].filter((result) => result === "L").length,
        games: team.form.length,
      },
      source: "derived",
    });
  }
  const { wins, losses } = team.venue_record;
  if (wins + losses > 0) {
    push({
      type: "home_away_record",
      value: { team: team.team, venue, wins, losses, games: wins + losses },
      source: "derived",
    });
  }
  if (team.top_scorer && team.top_scorer.goals > 0) {
    push({
      type: "player_form",
      value: {
        player: team.top_scorer.player,
        team: team.team,
        goals: team.top_scorer.goals,
        games: FORM_GAMES,
      },
      source: "derived",
    });
  }
  if (team.table) {
    push({ type: "table_position", value: { team: team.team, ...team.table }, source: "derived" });
  }
  if (team.stake) {
    push({ type: "stake", value: { team: team.team, ...team.stake }, source: input.model_source });
  }
}

export function build_preview_fact_sheet(input: PreviewFactSheetInput): FactSheet {
  const facts: Fact[] = [];
  // Every fact gets the next id; the casts keep the discriminated union intact.
  const push = (fact: Omit<Fact, "fact_id">) => {
    facts.push({ ...fact, fact_id: `f${String(facts.length + 1)}` } as Fact);
  };
  if (input.win_chance) {
    push({
      type: "win_chance",
      value: {
        home_team: input.home.team,
        away_team: input.away.team,
        home_win: input.win_chance.home_win,
        away_win: input.win_chance.away_win,
      },
      source: input.model_source,
    });
  }
  team_facts(input.home, "home", input, push);
  team_facts(input.away, "away", input, push);
  for (const meeting of input.meetings.slice(0, MEETING_COUNT)) {
    push({ type: "head_to_head", value: { ...meeting }, source: "liiga_api" });
  }
  return { game_id: input.game_id, built_at: input.built_at, facts, kind: "preview" };
}
