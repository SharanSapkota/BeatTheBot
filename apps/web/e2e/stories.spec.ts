import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Step 10 part B: AI preview and AI summary for every sport. The texts are written by the API's
// story job (template texts while no LLM key is set; the LLM is never called from tests).
// Screenshots go to e2e/screenshots/<project>/.

const API = "http://localhost:3000/api/v1";

interface GameRef {
  id: string;
  start_time: string;
}

interface StoryRef {
  body: string;
  label_text: string;
  last_meetings: unknown[];
  why_it_matters: string | null;
}

async function save_screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

async function stories_of(request: APIRequestContext, game_id: string) {
  const response = await request.get(`${API}/games/${game_id}/stories`);
  return (
    (await response.json()) as { data: { preview: StoryRef | null; summary: StoryRef | null } }
  ).data;
}

/** The first upcoming game of the sport whose published preview has last meetings. */
async function game_with_preview(request: APIRequestContext, sport: string) {
  const response = await request.get(`${API}/games?state=upcoming&sport=${sport}`);
  const games = ((await response.json()) as { data: GameRef[] }).data;
  for (const game of games.slice(0, 12)) {
    const { preview } = await stories_of(request, game.id);
    if (preview && preview.last_meetings.length > 0) {
      return { game, preview };
    }
  }
  return null;
}

async function latest_result(request: APIRequestContext, sport: string) {
  const response = await request.get(`${API}/games/overview?sport=${sport}`);
  const { data } = (await response.json()) as {
    data: { latest_results: { games: GameRef[]; summary_lines: Record<string, string> } | null };
  };
  const game = data.latest_results?.games.find(
    (candidate) => data.latest_results?.summary_lines[candidate.id],
  );
  return game ? { game, line: data.latest_results?.summary_lines[game.id] ?? "" } : null;
}

test("Before: AI PREVIEW with bullets, Why it matters, last meetings and the label", async ({
  page,
  request,
}) => {
  const found = await game_with_preview(request, "hockey");
  test.skip(found === null, "no upcoming hockey game with a published preview yet");
  await page.goto(`/games/${found?.game.id ?? ""}`);
  await expect(page.getByText("AI PREVIEW")).toBeVisible();
  await expect(page.getByText("Last meetings")).toBeVisible();
  if (found?.preview.why_it_matters) {
    await expect(page.getByText("Why it matters:")).toBeVisible();
  }
  await expect(page.getByText(found?.preview.label_text ?? "")).toBeVisible();
  await expect(page.getByRole("button", { name: "Report an error" }).first()).toBeVisible();
  await expect(page.getByText(/AI pick|will win|bet/i)).toHaveCount(0);
  await save_screenshot(page, "42_before_ai_preview");
});

test("After: AI SUMMARY with the label and a report button; the hub shows its first sentence", async ({
  page,
  request,
}) => {
  const found = await latest_result(request, "hockey");
  test.skip(found === null, "no latest hockey result with a published summary yet");

  await page.goto("/games/hockey");
  const latest = page.getByRole("region", { name: "Latest results" });
  // Each row has a phone and a desktop layout; only one of them is visible.
  await expect(
    latest
      .getByText(found?.line ?? "")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await save_screenshot(page, "43_hub_summary_line");

  await page.goto(`/games/${found?.game.id ?? ""}`);
  await expect(page.getByText("AI SUMMARY")).toBeVisible();
  await expect(
    page.getByText(/Written with AI from Liiga data|Automatic summary from Liiga data/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Report an error" }).first()).toBeVisible();
  await save_screenshot(page, "44_after_ai_summary");
});

test("football sample games: the AI summary is labelled as sample data", async ({
  page,
  request,
}) => {
  const found = await latest_result(request, "football");
  test.skip(found === null, "no football result with a published summary yet");
  await page.goto(`/games/${found?.game.id ?? ""}`);
  await expect(page.getByText("AI SUMMARY")).toBeVisible();
  await expect(page.getByText(/from sample data/)).toBeVisible();
  await save_screenshot(page, "45_after_football_sample_summary");
});
