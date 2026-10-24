import {
  data_source_schema,
  sport_schema,
  type DataSource,
  type Sport,
  type TeamSummary,
} from "@voita_kone/shared_types";

export interface TeamRow {
  id: string;
  external_id: string;
  name: string;
  short_name: string;
  city: string | null;
  logo_url: string | null;
  sport: string;
  data_source: string;
}

/** DB text column to the typed value; throws if the DB holds something unexpected. */
export function to_data_source(value: string): DataSource {
  return data_source_schema.parse(value);
}

export function to_sport(value: string): Sport {
  return sport_schema.parse(value);
}

export function to_team_summary(team: TeamRow): TeamSummary {
  return {
    id: team.id,
    external_id: team.external_id,
    name: team.name,
    short_name: team.short_name,
    city: team.city,
    logo_url: team.logo_url,
    sport: to_sport(team.sport),
    data_source: to_data_source(team.data_source),
  };
}
