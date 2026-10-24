import { classify_claims } from "@voita_kone/fact_checker";
import { describe, expect, it } from "vitest";
import { ScriptedLlmClient } from "../../test_helpers/scripted_llm_client";
import { bullets_of } from "./stories_service";
import { output_problem, write_story } from "./story_writer";
import { template_preview, template_summary } from "./story_templates";
import { GOOD_SUMMARY, KNOWN_NAMES, PREVIEW_SHEET, SUMMARY_SHEET } from "./test_sheets";

describe("write_story with the LLM", () => {
  it("publishes a fully verified summary as green and strips the fact ids", async () => {
    const story = await write_story(
      new ScriptedLlmClient([GOOD_SUMMARY]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story.traffic_light).toBe("green");
    expect(story.source).toBe("llm");
    expect(story.body).not.toContain("[f");
    expect(story.check.claims.every((claim) => claim.status === "verified")).toBe(true);
  });

  it("retries a planted wrong number and passes when the second answer is right", async () => {
    const llm = new ScriptedLlmClient([GOOD_SUMMARY.replace("27%", "19%"), GOOD_SUMMARY]);

    const story = await write_story(llm, "summary", SUMMARY_SHEET, KNOWN_NAMES);

    expect(story).toMatchObject({ traffic_light: "green", attempts: 2 });
    expect(llm.requests[1]?.prompt).toContain('"19%"');
  });

  it("is red when the wrong number stays after 2 retries", async () => {
    const story = await write_story(
      new ScriptedLlmClient([GOOD_SUMMARY.replace("27%", "19%")]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story).toMatchObject({ traffic_light: "red", attempts: 3 });
    expect(story.check.traffic_light_reasons[0]).toContain('Wrong claim "19%"');
  });

  it("is red for a wrong name and for an invented player", async () => {
    const wrong_name = await write_story(
      new ScriptedLlmClient([GOOD_SUMMARY.replace("Joonas Niemi", "Ville Koskinen")]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );
    const invented = await write_story(
      new ScriptedLlmClient([GOOD_SUMMARY.replace("Joonas Niemi", "Matti Virtanen")]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(wrong_name.traffic_light).toBe("red");
    expect(invented.traffic_light).toBe("red");
    expect(invented.check.claims).toContainEqual(
      expect.objectContaining({ claim: "Matti Virtanen", status: "wrong" }),
    );
  });

  it("is red when the text tips a winner", async () => {
    const story = await write_story(
      new ScriptedLlmClient([
        GOOD_SUMMARY.replace(
          "It was a good night for the home crowd.",
          "Kärpät will win again on Saturday.",
        ),
      ]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story.traffic_light).toBe("red");
    expect(story.check.tips).toEqual(["will win"]);
  });

  it("is red when the text touches an injury", async () => {
    const story = await write_story(
      new ScriptedLlmClient([
        GOOD_SUMMARY.replace(
          "It was a good night for the home crowd.",
          "Laine was injured late on.",
        ),
      ]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story.traffic_light).toBe("red");
  });

  it("is yellow when a claim is not in the sheet but contradicts nothing", async () => {
    const story = await write_story(
      new ScriptedLlmClient([GOOD_SUMMARY.replace("for the home crowd.", "for the 4321 fans.")]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story.traffic_light).toBe("yellow");
    expect(story.check.traffic_light_reasons).toEqual(['Not in the fact sheet: "4321"']);
  });

  it("is red (LLM error) when the answer is unusable", async () => {
    const story = await write_story(
      new ScriptedLlmClient(["Kärpät won [f1]."]),
      "summary",
      SUMMARY_SHEET,
      KNOWN_NAMES,
    );

    expect(story.traffic_light).toBe("red");
    expect(story.check.llm_error).toContain("words");
  });
});

describe("template fallback", () => {
  it("writes the automatic text, green, when there is no LLM", async () => {
    const story = await write_story(undefined, "summary", SUMMARY_SHEET, KNOWN_NAMES);

    expect(story).toMatchObject({
      source: "template",
      traffic_light: "green",
      model_name: "template",
    });
  });

  it("writes the automatic text when the LLM is down", async () => {
    const story = await write_story(
      new ScriptedLlmClient(["unavailable"]),
      "preview",
      PREVIEW_SHEET,
      KNOWN_NAMES,
    );

    expect(story).toMatchObject({ source: "template", traffic_light: "green" });
  });

  it("verifies every claim of both templates", () => {
    for (const [text, sheet] of [
      [template_summary(SUMMARY_SHEET), SUMMARY_SHEET],
      [template_preview(PREVIEW_SHEET), PREVIEW_SHEET],
    ] as const) {
      const unverified = classify_claims(text, sheet, KNOWN_NAMES).filter(
        (claim) => claim.status !== "verified",
      );
      expect(unverified).toEqual([]);
    }
  });

  it("writes the preview as 3 bullets with form, last meeting and Data says", () => {
    const bullets = bullets_of("preview", template_preview(PREVIEW_SHEET));

    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe(
      "Kärpät won 3 of their last 5 games, Ilves 1 of 5. In form: Kärpät's Eetu Laine has 4 goals in the last 5 games.",
    );
    expect(bullets[1]).toBe("They last met on 24 Oct: Kärpät 3–1 Ilves.");
    expect(bullets[2]).toContain("Data says Kärpät have a 62% chance of winning and Ilves 38%.");
  });

  it("writes the summary from the result, scorers, winning goal, table, odds and next game", () => {
    expect(template_summary(SUMMARY_SHEET)).toBe(
      "Kärpät beat Ilves 3–1. Scorers: Eetu Laine, Aleksi Mäkelä, Joonas Niemi. " +
        "Joonas Niemi scored the winning goal at 38:20. Kärpät move from 13th to 12th with 28 points. " +
        "Kärpät's chance of relegation went from 34% to 27%. Next, Kärpät play Jukurit away on Saturday.",
    );
  });
});

describe("output_problem", () => {
  it("asks for 3 bullets in a preview and about 60–90 words", () => {
    const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");
    expect(output_problem("summary", words(70))).toBeNull();
    expect(output_problem("summary", words(10))).toContain("10 words");
    expect(output_problem("preview", `- ${words(30)}\n- ${words(30)}`)).toBe(
      "2 bullets (expected 3)",
    );
  });
});
