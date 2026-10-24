import { z } from "zod";
import { api_success_schema } from "./api_response";
import { leaderboard_schema } from "./leaderboard";

// Elections (step 7): fans predict who gets the most votes. No AI anywhere in elections.
// Fairness rules: docs/architecture.md → Elections.

export const election_type_schema = z.enum([
  "parliamentary",
  "municipal",
  "presidential",
  "county",
  "other",
]);
export const area_type_schema = z.enum(["country", "electoral_district", "municipality"]);
export const election_status_schema = z.enum(["draft", "published", "closed", "resulted"]);
/** The statuses users can see (drafts are admin only). */
export const public_election_status_schema = z.enum(["published", "closed", "resulted"]);

/** Results are shown only from this many picks on. */
export const ELECTION_RESULTS_MIN_PICKS = 20;
export const CANDIDATE_BIO_MAX_LENGTH = 200;
export const ELECTION_RESULTS_LABEL =
  "Not a scientific poll. Shows only the picks of Voita Kaleva users.";

export const election_candidate_schema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  party_or_group: z.string().nullable(),
  candidate_number: z.number().int().nullable(),
  short_bio: z.string(),
  photo_url: z.string().nullable(),
});

export const election_summary_schema = z.object({
  id: z.uuid(),
  title: z.string(),
  election_type: election_type_schema,
  area_type: area_type_schema,
  area_name: z.string(),
  /** YYYY-MM-DD (Helsinki). */
  election_date: z.string(),
  poll_opens_at: z.string(),
  poll_closes_at: z.string(),
  status: election_status_schema,
  /** Picks can be made or changed now (server clock). */
  is_poll_open: z.boolean(),
  question_text: z.string(),
  is_demo: z.boolean(),
  candidate_count: z.number().int().min(0),
});

export const election_my_pick_schema = z.object({
  candidate_id: z.uuid(),
  points_awarded: z.number().int().nullable(),
});

/** GET /elections/:id: candidates in the user's own random order. */
export const election_detail_schema = election_summary_schema.extend({
  candidates: z.array(election_candidate_schema),
  my_pick: election_my_pick_schema.nullable(),
  winner_candidate_id: z.uuid().nullable(),
});

/** GET /elections */
export const election_list_schema = z.object({
  /** Every area with a visible election (filter chips). */
  areas: z.array(z.string()),
  elections: z.array(election_summary_schema),
});

export const election_list_query_schema = z.object({
  area: z.string().trim().min(1).optional(),
  status: public_election_status_schema.optional(),
});

/** POST / PUT /elections/:id/picks */
export const election_pick_request_schema = z.object({ candidate_id: z.uuid() });

export const election_pick_schema = z.object({
  election_id: z.uuid(),
  candidate_id: z.uuid(),
  points_awarded: z.number().int().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const results_hidden_reason_schema = z.enum(["pick_first", "not_enough_picks"]);

/** GET /elections/:id/results: shares in the user's candidate order, or null while hidden. */
export const election_results_schema = z.object({
  election_id: z.uuid(),
  total_picks: z.number().int().min(0),
  min_picks: z.number().int(),
  hidden_reason: results_hidden_reason_schema.nullable(),
  shares: z
    .array(
      z.object({
        candidate_id: z.uuid(),
        picks: z.number().int().min(0),
        share: z.number().min(0).max(1),
      }),
    )
    .nullable(),
  winner_candidate_id: z.uuid().nullable(),
  label_text: z.string(),
});

/** GET /leaderboard/elections: separate from games, no prizes. */
export const election_leaderboard_schema = z.object({
  /** Resulted elections. */
  elections_count: z.number().int().min(0),
  points_per_correct: z.number().int(),
  rows: leaderboard_schema.shape.rows,
});

// Admin (role admin).

const optional_text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const iso_time_schema = z.iso.datetime({ offset: true });

export const admin_election_request_schema = z.object({
  title: z.string().trim().min(1).max(120),
  election_type: election_type_schema,
  area_type: area_type_schema,
  area_name: z.string().trim().min(1).max(80),
  election_date: z.iso.date(),
  poll_opens_at: iso_time_schema,
  poll_closes_at: iso_time_schema,
  /** Empty → "Who will get the most votes in <area>?" */
  question_text: optional_text(200),
  is_demo: z.boolean().default(false),
});

export const admin_candidate_request_schema = z.object({
  full_name: z.string().trim().min(1).max(80),
  party_or_group: optional_text(80),
  candidate_number: z
    .number()
    .int()
    .min(1)
    .max(99999)
    .nullish()
    .transform((value) => value ?? null),
  short_bio: z.string().trim().max(CANDIDATE_BIO_MAX_LENGTH).default(""),
  photo_url: z
    .url({ protocol: /^https$/ })
    .nullish()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export const admin_result_request_schema = z.object({
  winner_candidate_id: z.uuid(),
  /** Votes per candidate id (optional). */
  vote_counts: z
    .record(z.uuid(), z.number().int().min(0))
    .nullish()
    .transform((v) => v ?? null),
});

export const admin_election_schema = election_summary_schema.extend({
  candidates: z.array(election_candidate_schema),
  pick_count: z.number().int().min(0),
  result: z
    .object({
      winner_candidate_id: z.uuid(),
      vote_counts: z.record(z.string(), z.number()).nullable(),
      entered_at: z.string(),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const election_list_response_schema = api_success_schema(election_list_schema);
export const election_detail_response_schema = api_success_schema(election_detail_schema);
export const election_pick_response_schema = api_success_schema(election_pick_schema);
export const election_results_response_schema = api_success_schema(election_results_schema);
export const election_leaderboard_response_schema = api_success_schema(election_leaderboard_schema);
export const admin_election_response_schema = api_success_schema(admin_election_schema);
export const admin_elections_response_schema = api_success_schema(z.array(admin_election_schema));

export type ElectionType = z.infer<typeof election_type_schema>;
export type AreaType = z.infer<typeof area_type_schema>;
export type ElectionStatus = z.infer<typeof election_status_schema>;
export type PublicElectionStatus = z.infer<typeof public_election_status_schema>;
export type ElectionCandidate = z.infer<typeof election_candidate_schema>;
export type ElectionSummary = z.infer<typeof election_summary_schema>;
export type ElectionDetail = z.infer<typeof election_detail_schema>;
export type ElectionList = z.infer<typeof election_list_schema>;
export type ElectionListQuery = z.infer<typeof election_list_query_schema>;
export type ElectionPickRequest = z.infer<typeof election_pick_request_schema>;
export type ElectionPick = z.infer<typeof election_pick_schema>;
export type ResultsHiddenReason = z.infer<typeof results_hidden_reason_schema>;
export type ElectionResults = z.infer<typeof election_results_schema>;
export type ElectionLeaderboard = z.infer<typeof election_leaderboard_schema>;
export type AdminElectionRequest = z.infer<typeof admin_election_request_schema>;
export type AdminElectionInput = z.input<typeof admin_election_request_schema>;
export type AdminCandidateRequest = z.infer<typeof admin_candidate_request_schema>;
export type AdminCandidateInput = z.input<typeof admin_candidate_request_schema>;
export type AdminResultRequest = z.infer<typeof admin_result_request_schema>;
export type AdminElection = z.infer<typeof admin_election_schema>;
