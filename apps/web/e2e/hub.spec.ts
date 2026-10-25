import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Step 10 part A: the games hub is never empty. The browser clock is fixed to a real day
// without hockey games, so the hub shows LATEST RESULTS and COMING UP instead of nothing.
// Screenshots go to e2e/screenshots/<project>/.

const API = "http://localhost:3000/api/v1";

interface Overview {
  today: unknown[];
  latest_results: { date: string } | null;
  coming_up: { date: string; games: unknown[] } | null;
}

async function save_screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

function add_days(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** The first day from today on with no hockey game but results before and games after it. */
async function find_empty_day(request: APIRequestContext): Promise<string | null> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Helsinki" });
  for (let offset = 0; offset < 21; offset += 1) {
    const date = add_days(today, offset);
    const response = await request.get(`${API}/games/overview?sport=hockey&date=${date}`);
    const { data } = (await response.json()) as { data: Overview };
    if (data.today.length === 0 && data.latest_results && data.coming_up) {
      return date;
    }
  }
  return null;
}

test("hub on a day without games: latest results, coming up and the next big game", async ({
  page,
  request,
}) => {
  const empty_day = await find_empty_day(request);
  test.skip(empty_day === null, "no day without hockey games in the next three weeks");
  // 12:00 in Helsinki on that day.
  await page.clock.setFixedTime(new Date(`${empty_day ?? ""}T09:00:00Z`));

  await page.goto("/games/hockey");
  await expect(page.getByRole("heading", { name: "No games today." })).toBeVisible();
  await expect(page.getByText(/^Next games: \w{3} \d{1,2} \w{3}$/)).toBeVisible();
  await expect(page.getByText("NEXT BIG GAME")).toBeVisible();
  const latest = page.getByRole("region", { name: "Latest results" });
  await expect(latest).toBeVisible();
  await expect(latest.getByRole("link").first()).toContainText(/FINAL|See result/);
  await save_screenshot(page, "40_hub_no_games_today");

  // A latest result opens the After screen.
  await latest.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/final/i).first()).toBeVisible();

  // The day switcher browses any day.
  await page.goto("/games/hockey");
  await page.getByRole("button", { name: /^Next day:/ }).click();
  await expect(page).toHaveURL(/\?date=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
});

test("football and basketball always have latest results and coming games (sample data)", async ({
  page,
}) => {
  for (const sport of ["football", "basketball"]) {
    await page.goto(`/games/${sport}`);
    await expect(page.getByRole("region", { name: "Latest results" })).toBeVisible();
    await expect(page.getByText("Sample data").first()).toBeVisible();
  }
  await save_screenshot(page, "41_hub_basketball_sections");
});
