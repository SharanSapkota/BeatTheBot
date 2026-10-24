import { describe, expect, it } from "vitest";
import { classify_claims } from "./check_claims";
import { find_escalation_words, find_tips } from "./escalation";
import { KNOWN_NAMES, SHEET } from "./test_sheet";

function statuses(text: string) {
  return classify_claims(text, SHEET, KNOWN_NAMES).map((claim) => [claim.claim, claim.status]);
}

describe("classify_claims", () => {
  it("verifies every claim of a correct, cited text and names the supporting facts", () => {
    const claims = classify_claims(
      "Kärpät beat Ilves 3–1 [f1]. Eetu Laine scored the winner at 51:03 [f4].",
      SHEET,
      KNOWN_NAMES,
    );
    expect(claims.every((claim) => claim.status === "verified")).toBe(true);
    // 3–1 is the final score (f1) and the score after the last goal (f4).
    expect(claims.find((claim) => claim.claim === "3–1")?.fact_ids).toEqual(["f1", "f4"]);
    expect(claims.find((claim) => claim.claim === "51:03")?.fact_ids).toEqual(["f4"]);
  });

  it("marks a planted wrong number in a cited sentence as wrong", () => {
    expect(statuses("Kärpät beat Ilves 4–1 [f1].")).toContainEqual(["4–1", "wrong"]);
    expect(statuses("Kärpät's relegation chance is now 19% [f6].")).toContainEqual([
      "19%",
      "wrong",
    ]);
  });

  it("marks an uncited value it can't find as not found", () => {
    expect(statuses("The crowd was 4321.")).toEqual([["4321", "not_found"]]);
  });

  it("marks a real player who is not in the fact sheet as wrong", () => {
    expect(statuses("Joonas Niemi scored [f2].")).toContainEqual(["Joonas Niemi", "wrong"]);
  });

  it("marks an invented player as wrong", () => {
    const claims = classify_claims("Matti Virtanen scored twice [f2].", SHEET, KNOWN_NAMES);
    expect(claims).toContainEqual(
      expect.objectContaining({ claim: "Matti Virtanen", status: "wrong", type: "name" }),
    );
  });

  it("does not take sentence starts, weekdays or known names for invented players", () => {
    const text =
      "Next up for Kärpät is Jukurit away on Saturday [f7]. After the game Eetu Laine smiled [f2].";
    expect(
      classify_claims(text, SHEET, KNOWN_NAMES).filter((claim) => claim.status !== "verified"),
    ).toEqual([]);
  });

  it("checks bullet lines one by one", () => {
    expect(statuses("- Kärpät won 3–1 [f1]\n- Ilves scored 9 [f3]")).toContainEqual(["9", "wrong"]);
  });
});

describe("find_tips", () => {
  it("finds a text that tips or predicts a winner", () => {
    expect(find_tips("Kärpät will win this one.")).toEqual(["will win"]);
    expect(find_tips("Ilves are the favourites tonight.")).toEqual(["favourite"]);
    expect(find_tips("Data says Kärpät have a 62% chance.")).toEqual([]);
  });
});

describe("find_escalation_words", () => {
  it("finds injury, legal and personal topics", () => {
    expect(find_escalation_words("He was injured")).toEqual(["injur"]);
    expect(find_escalation_words("The police were called")).toEqual(["police"]);
    expect(find_escalation_words("a family matter")).toEqual(["family"]);
    expect(find_escalation_words("Kärpät won 3–1.")).toEqual([]);
  });
});
