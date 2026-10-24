import type { Transaction } from "kysely";
import { add_local_days, to_helsinki_date } from "../../common/helsinki_date";
import { default_question, voting_close_time } from "../../modules/elections/election_rules";
import type { DB } from "../database_types";

// One published demo election with FICTIONAL candidates (invented names, clearly fake) and
// 30 demo picks, so the results show. Never use real politicians' names here or in tests.

export const DEMO_ELECTION_AREA = "Oulu";
export const DEMO_VOTER_COUNT = 30;
/** provider_subject prefix of the demo voters' device identities. */
export const DEMO_VOTER_DEVICE_PREFIX = "demo_device_voter_";
const DAYS_UNTIL_ELECTION = 21;

export interface DemoCandidate {
  full_name: string;
  party_or_group: string;
  candidate_number: number;
  short_bio: string;
  /** How many of the 30 demo voters pick this candidate. */
  demo_picks: number;
}

// prettier-ignore
export const DEMO_CANDIDATES: readonly DemoCandidate[] = [
  { full_name: "Aino Esimerkki", party_or_group: "Demo List A", candidate_number: 12, short_bio: "Fictional demo candidate. Teacher, likes cross-country skiing and the Oulu market square.", demo_picks: 9 },
  { full_name: "Veikko Testinen", party_or_group: "Demo List B", candidate_number: 27, short_bio: "Fictional demo candidate. Bus driver who wants more evening buses to the suburbs.", demo_picks: 7 },
  { full_name: "Liisa Kuvitelma", party_or_group: "Demo List C", candidate_number: 35, short_bio: "Fictional demo candidate. Nurse and choir singer, focused on health services.", demo_picks: 6 },
  { full_name: "Pekka Mallinen", party_or_group: "Demo List A", candidate_number: 41, short_bio: "Fictional demo candidate. Runs a small bakery and coaches junior football.", demo_picks: 5 },
  { full_name: "Sanni Keksitty", party_or_group: "Demo Independents", candidate_number: 58, short_bio: "Fictional demo candidate. Student who wants cheaper student housing.", demo_picks: 3 },
];

export interface DemoElection {
  title: string;
  election_type: "municipal";
  area_type: "municipality";
  area_name: string;
  election_date: string;
  poll_opens_at: Date;
  poll_closes_at: Date;
  status: "published";
  question_text: string;
  is_demo: true;
}

/** The demo election, about three weeks from now; the poll opened a day ago. */
export function build_demo_election(now: Date): DemoElection {
  const election_date = add_local_days(to_helsinki_date(now), DAYS_UNTIL_ELECTION);
  return {
    title: "Demo election",
    election_type: "municipal",
    area_type: "municipality",
    area_name: DEMO_ELECTION_AREA,
    election_date,
    poll_opens_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    poll_closes_at: voting_close_time(election_date),
    status: "published",
    question_text: default_question(DEMO_ELECTION_AREA),
    is_demo: true,
  };
}

/** Device ids of the demo voters, one per pick, assigned to candidates in list order. */
export function demo_voter_picks(): { device_id: string; candidate_index: number }[] {
  return DEMO_CANDIDATES.flatMap((candidate, candidate_index) =>
    Array.from({ length: candidate.demo_picks }, () => candidate_index),
  ).map((candidate_index, index) => ({
    device_id: `${DEMO_VOTER_DEVICE_PREFIX}${String(index + 1).padStart(2, "0")}`,
    candidate_index,
  }));
}

/** Removes the demo elections (cascades to candidates, picks, results) and the demo voters. */
export async function delete_demo_election(trx: Transaction<DB>): Promise<void> {
  await trx.deleteFrom("elections").where("is_demo", "=", true).execute();
  const voters = trx
    .selectFrom("auth_identities")
    .select("user_id")
    .where("provider", "=", "device")
    .where("provider_subject", "like", `${DEMO_VOTER_DEVICE_PREFIX}%`);
  await trx.deleteFrom("users").where("id", "in", voters).execute();
}

/** Inserts the demo election, its candidates, 30 demo voters and their picks. Returns the pick count. */
export async function insert_demo_election(trx: Transaction<DB>, now: Date): Promise<number> {
  const { id: election_id } = await trx
    .insertInto("elections")
    .values(build_demo_election(now))
    .returning("id")
    .executeTakeFirstOrThrow();
  const candidate_rows = await trx
    .insertInto("election_candidates")
    .values(
      DEMO_CANDIDATES.map(({ demo_picks: _picks, ...candidate }) => ({
        ...candidate,
        election_id,
      })),
    )
    .returning("id")
    .execute();
  const picks = demo_voter_picks();
  for (const [index, pick] of picks.entries()) {
    const { id: user_id } = await trx
      .insertInto("users")
      .values({ display_name: `Demo fan ${String(index + 1).padStart(2, "0")}`, role: "user" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("auth_identities")
      .values({ user_id, provider: "device", provider_subject: pick.device_id })
      .execute();
    const candidate = candidate_rows[pick.candidate_index];
    if (candidate) {
      await trx
        .insertInto("election_picks")
        .values({ user_id, election_id, candidate_id: candidate.id, created_at: now })
        .execute();
    }
  }
  return picks.length;
}
