import { describe, expect, it } from "vitest";
import {
  DEMO_CANDIDATES,
  DEMO_VOTER_COUNT,
  build_demo_election,
  demo_voter_picks,
} from "./demo_election";

const NOW = new Date("2026-10-24T12:00:00.000Z");

describe("demo election", () => {
  it("is a published demo election in Oulu about three weeks from now", () => {
    const election = build_demo_election(NOW);
    expect(election).toMatchObject({
      title: "Demo election",
      area_name: "Oulu",
      status: "published",
      is_demo: true,
      election_date: "2026-11-14",
      question_text: "Who will get the most votes in Oulu?",
    });
    expect(election.poll_opens_at < NOW).toBe(true);
    // Closes at voting close: 20:00 Helsinki on election day.
    expect(election.poll_closes_at.toISOString()).toBe("2026-11-14T18:00:00.000Z");
  });

  it("has five fictional candidates, each marked as fictional", () => {
    expect(DEMO_CANDIDATES).toHaveLength(5);
    expect(DEMO_CANDIDATES.every((candidate) => candidate.short_bio.startsWith("Fictional"))).toBe(
      true,
    );
    expect(DEMO_CANDIDATES.every((candidate) => candidate.party_or_group.startsWith("Demo"))).toBe(
      true,
    );
  });

  it("makes 30 picks from 30 different demo voters", () => {
    const picks = demo_voter_picks();
    expect(picks).toHaveLength(DEMO_VOTER_COUNT);
    expect(new Set(picks.map((pick) => pick.device_id)).size).toBe(DEMO_VOTER_COUNT);
  });
});
