import { describe, expect, it } from "vitest";
import { check_claims } from "./check_claims";
import { KNOWN_NAMES, SHEET } from "./test_sheet";

function check(text: string) {
  return check_claims(text, SHEET, KNOWN_NAMES);
}

function failed(text: string): string[] {
  return check(text).failed_claims.map((failure) => failure.claim);
}

const CORRECT_STORY =
  "Kärpät beat Ilves 3–1 at home. Eetu Laine scored twice, the winner at 51:03 in the 3rd period. " +
  "The win moves Kärpät from 13th to 12th place with 28 points. Their chance of relegation fell " +
  "from 34% to 27%, down 7 percentage points. Next up: Jukurit away on Saturday 31 Oct.";

describe("check_claims", () => {
  it("passes a story where every claim matches the sheet", () => {
    const result = check(CORRECT_STORY);

    expect(result.failed_claims).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.claims_checked).toBeGreaterThan(12);
  });

  describe("scores", () => {
    it("accepts the final score and scores after goals, in either order and with a hyphen", () => {
      expect(failed("A 3-1 win. It was 1–1 after Mäkelä. Ilves lost 1–3.")).toEqual([]);
    });

    it("fails a score that never happened", () => {
      expect(check("Kärpät won 4–1.").failed_claims).toEqual([
        { claim: "4–1", type: "score", reason: "no matching score" },
      ]);
    });
  });

  describe("percentages", () => {
    it("accepts a rounded probability (26.8% → 27%) and the exact one", () => {
      expect(failed("Relegation risk 27%, before 34 %. Precisely 26.8 per cent.")).toEqual([]);
    });

    it("rounds half up without floating-point surprises (0.705 → 71%)", () => {
      const edge = {
        ...SHEET,
        facts: [
          {
            fact_id: "f1",
            type: "season_odds" as const,
            value: { team: "Ilves", kind: "relegation" as const, before: 0.355, after: 0.705 },
            source: "prediction_model:poisson_mc_v1" as const,
          },
        ],
      };

      expect(check_claims("From 36% to 71%.", edge, []).passed).toBe(true);
    });

    it("fails a percentage more than half a point off", () => {
      expect(failed("The risk is now 28%.")).toEqual(["28%"]);
    });
  });

  describe("numbers and ordinals", () => {
    it("accepts ranks, points, goals and periods from the sheet", () => {
      expect(failed("12th with 28 points, up from 13th and 25 points, 3 more.")).toEqual([]);
    });

    it("fails numbers and ordinals that are not in the sheet", () => {
      expect(failed("Kärpät are 9th with 31 points.")).toEqual(["9th", "31"]);
    });

    it("allows the 4 of 'top-4' only when the sheet has a top-4 stake", () => {
      const top_4_sheet = {
        ...SHEET,
        facts: [
          ...SHEET.facts,
          {
            fact_id: "f8",
            type: "season_odds" as const,
            value: { team: "Ilves", kind: "top_4" as const, before: 0.48, after: 0.42 },
            source: "prediction_model:poisson_mc_v1" as const,
          },
        ],
      };

      expect(check_claims("Ilves's top-4 chance is 42%.", top_4_sheet, KNOWN_NAMES).passed).toBe(
        true,
      );
      expect(failed("A top-4 finish.")).toEqual(["4"]);
    });

    it("fails decimals the sheet doesn't have", () => {
      expect(failed("Ilves score 2.1 goals per game.")).toEqual(["2.1"]);
    });
  });

  describe("goal times", () => {
    it("accepts a goal time from the sheet", () => {
      expect(failed("Laine scored at 14:37.")).toEqual([]);
    });

    it("fails a goal time that doesn't match", () => {
      expect(failed("Laine scored at 51:30.")).toEqual(["51:30"]);
    });
  });

  describe("dates and days", () => {
    it("accepts the game date and the next game's date and weekday in several forms", () => {
      expect(failed("On 24 Oct. Next: Saturday 31 Oct (31.10., 2026-10-31).")).toEqual([]);
    });

    it("fails a wrong date or weekday", () => {
      expect(failed("Next up on Friday 30 Oct.")).toEqual(["Friday", "30 Oct"]);
    });
  });

  describe("names", () => {
    it("accepts teams, players, last names and aliases in the sheet", () => {
      expect(failed("Oulun Kärpät and Kärppien Laine beat Mäkelä's Ilves.")).toEqual([]);
    });

    it("fails a real team or player that is not in the sheet (no invented players)", () => {
      expect(failed("Joonas Niemi helped Kärpät past Tappara.")).toEqual([
        "Joonas Niemi",
        "Tappara",
      ]);
    });

    it("fails a last name of a player who is not in the sheet", () => {
      expect(failed("Niemi scored the winner.")).toEqual(["Niemi"]);
    });

    it("does not treat a name inside a longer word as the name", () => {
      expect(failed("Ilvesläiset cheered.")).toEqual([]);
    });
  });
});

describe("planted errors (one changed fact each)", () => {
  const plants: [string, string, string][] = [
    ["score", "3–1", "3–2"],
    ["scorer", "Eetu Laine scored", "Joonas Niemi scored"],
    ["team", "Next up: Jukurit", "Next up: Tappara"],
    ["date", "31 Oct", "1 Nov"],
    ["weekday", "Saturday", "Sunday"],
    ["percentage", "to 27%", "to 21%"],
    ["rank", "12th place", "11th place"],
    ["goal time", "51:03", "52:03"],
  ];

  it.each(plants)("catches a wrong %s", (_label, right, wrong) => {
    const planted = CORRECT_STORY.replace(right, wrong);
    expect(planted).not.toBe(CORRECT_STORY);

    expect(check(planted).passed).toBe(false);
  });
});
