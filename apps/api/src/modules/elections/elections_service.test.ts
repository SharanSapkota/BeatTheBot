import { describe, expect, it } from "vitest";
import { AdminElectionsService } from "./admin_elections_service";
import type {
  CandidateRow,
  ChangeAudit,
  ElectionPointsRow,
  ElectionRow,
  ElectionsRepository,
  PickRow,
  ResultRow,
  ResultValues,
} from "./elections_repository";
import { ElectionsService } from "./elections_service";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const ELECTION_ID = "e0000000-0000-4000-8000-000000000001";
const USER_ID = "u0000000-0000-4000-8000-000000000001";

function election(change: Partial<ElectionRow> = {}): ElectionRow {
  return {
    id: ELECTION_ID,
    title: "Test election",
    election_type: "municipal",
    area_type: "municipality",
    area_name: "Testila",
    election_date: "2026-11-14",
    poll_opens_at: new Date("2026-10-20T00:00:00Z"),
    poll_closes_at: new Date("2026-11-14T18:00:00Z"),
    question_text: "Who will get the most votes in Testila?",
    is_demo: false,
    status: "published",
    candidate_count: 2,
    created_at: NOW,
    updated_at: NOW,
    ...change,
  };
}

// Fictional names only.
const CANDIDATES: CandidateRow[] = [
  {
    id: "c1",
    election_id: ELECTION_ID,
    full_name: "Aino Esimerkki",
    party_or_group: null,
    candidate_number: 1,
    short_bio: "",
    photo_url: null,
  },
  {
    id: "c2",
    election_id: ELECTION_ID,
    full_name: "Veikko Testinen",
    party_or_group: null,
    candidate_number: 2,
    short_bio: "",
    photo_url: null,
  },
];

class FakeRepository implements ElectionsRepository {
  picks: PickRow[] = [];
  saved_result: ResultValues | undefined;
  status_change: { status: string; poll_closes_at: Date | undefined } | undefined;
  audits: ChangeAudit[] = [];
  points: ElectionPointsRow[] = [];

  constructor(public row: ElectionRow) {}

  list_elections = async () => [this.row];
  find_election = async (id: string) => (id === this.row.id ? this.row : undefined);
  list_candidates = async () => CANDIDATES;
  find_pick = async (user_id: string) =>
    user_id === USER_ID ? this.picks.find((pick) => pick.election_id === this.row.id) : undefined;
  insert_pick = async (_user_id: string, election_id: string, candidate_id: string) => {
    const pick = {
      election_id,
      candidate_id,
      points_awarded: null,
      created_at: NOW,
      updated_at: NOW,
    };
    this.picks.push(pick);
    return pick;
  };
  update_pick = async () => undefined;
  count_picks = async () => new Map<string, number>();
  find_result = async (): Promise<ResultRow | undefined> => undefined;
  list_election_points = async () => this.points;
  count_resulted_elections = async () => 1;
  create_election = async () => ELECTION_ID;
  update_election = async () => undefined;
  delete_election = async () => undefined;
  set_status = async (
    _id: string,
    status: string,
    poll_closes_at: Date | undefined,
    audit: ChangeAudit,
  ) => {
    this.status_change = { status, poll_closes_at };
    this.audits.push(audit);
  };
  create_candidate = async () => "c3";
  update_candidate = async () => undefined;
  delete_candidate = async () => undefined;
  save_result = async (_id: string, result: ResultValues, audit: ChangeAudit) => {
    this.saved_result = result;
    this.audits.push(audit);
  };
}

describe("ElectionsService", () => {
  it("hides drafts from users", async () => {
    const service = new ElectionsService(
      new FakeRepository(election({ status: "draft" })),
      () => NOW,
    );
    await expect(service.get(ELECTION_ID, null)).rejects.toMatchObject({
      code: "ELECTION_NOT_FOUND",
    });
    expect((await service.list({})).elections).toHaveLength(1);
  });

  it("refuses picks before the poll opens and after an admin closed it", async () => {
    const not_open = new ElectionsService(
      new FakeRepository(election({ poll_opens_at: new Date("2026-10-25T00:00:00Z") })),
      () => NOW,
    );
    await expect(not_open.create_pick(USER_ID, ELECTION_ID, "c1")).rejects.toMatchObject({
      code: "POLL_NOT_OPEN",
    });
    const closed = new ElectionsService(
      new FakeRepository(election({ status: "closed" })),
      () => NOW,
    );
    await expect(closed.create_pick(USER_ID, ELECTION_ID, "c1")).rejects.toMatchObject({
      code: "POLL_CLOSED",
    });
  });

  it("ranks the election leaderboard and marks the user's row", async () => {
    const repository = new FakeRepository(election());
    repository.points = [
      { user_id: "other", display_name: "Other", points: 20 },
      { user_id: USER_ID, display_name: "Me", points: 0 },
    ];
    const board = await new ElectionsService(repository, () => NOW).leaderboard(USER_ID);
    expect(board.rows.map((row) => [row.rank, row.kind, row.points])).toEqual([
      [1, "user", 20],
      [2, "you", 0],
    ]);
  });
});

describe("AdminElectionsService", () => {
  it("moves the poll close time to now on an early close and logs it", async () => {
    const repository = new FakeRepository(election());
    await new AdminElectionsService(repository, () => NOW).close("admin", ELECTION_ID);
    expect(repository.status_change).toEqual({ status: "closed", poll_closes_at: NOW });
    expect(repository.audits[0]).toMatchObject({
      actor_user_id: "admin",
      action: "election.close",
    });
  });

  it("scores 20 for the winner's pickers and 0 for the others", async () => {
    const repository = new FakeRepository(election({ status: "closed" }));
    await new AdminElectionsService(repository, () => NOW).enter_result("admin", ELECTION_ID, {
      winner_candidate_id: "c2",
      vote_counts: null,
    });
    expect([...(repository.saved_result?.points_by_candidate ?? [])]).toEqual([
      ["c1", 0],
      ["c2", 20],
    ]);
  });
});
