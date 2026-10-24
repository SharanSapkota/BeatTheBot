import { expect, test, type Page } from "@playwright/test";

// Step 8: sport tabs, a football demo replay with a draw pick and a basketball replay, then the
// leaderboard's sport tabs. Runs on both projects (mobile 390 x 844, desktop 1440 x 900) against
// the sample fixtures (pnpm --filter @voita_kone/api sports:seed_demo). Screenshots go to
// e2e/screenshots/<project>/.

const AI_PLAYER_TEXT = /AI pick|AI's pick|vs AI|beat the AI|Kaleva AI/i;

async function save_screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

async function expect_fans_only(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(AI_PLAYER_TEXT)).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

function sport_tab(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Sports" })
    .getByRole("link", { name: new RegExp(`^${name}`) });
}

async function open_sport(page: Page, sport: string, moment: "before" | "live" | "final") {
  await page.goto(`/games/${sport}?demo=1&moment=${moment}`);
  await expect(page.getByRole("heading", { name: "Today's games" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("sport tabs: switch, keep demo mode, remember the last tab", async ({ page }) => {
  await page.goto("/games?demo=1&moment=before");
  await expect(page).toHaveURL(/\/games\/hockey\?demo=1&moment=before/);
  await expect(sport_tab(page, "Hockey")).toHaveAttribute("aria-current", "page");

  await sport_tab(page, "Football").click();
  await expect(page).toHaveURL(/\/games\/football\?demo=1&moment=before/);
  await expect(sport_tab(page, "Football")).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sample data").filter({ visible: true }).first()).toBeVisible();
  await expect(
    page
      .getByText(/Veikkausliiga/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect_fans_only(page);
  await save_screenshot(page, "20_hub_football");

  await sport_tab(page, "Basketball").click();
  await expect(page).toHaveURL(/\/games\/basketball/);
  await expect(
    page
      .getByText(/Korisliiga/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await save_screenshot(page, "21_hub_basketball");

  // /games opens the tab used last on this device.
  await page.goto("/games?demo=1&moment=before");
  await expect(page).toHaveURL(/\/games\/basketball\?demo=1&moment=before/);
});

test("football demo replay: pick a draw, follow it live, see the points", async ({ page }) => {
  // Before: KuPS vs SJK (yesterday's sample 1–1, replayed).
  await open_sport(page, "football", "before");
  await page.getByRole("link", { name: /^KuPS vs SJK/ }).click();
  await expect(page.getByText("1 · Result: 1 X 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data says" })).toHaveCount(0);
  await expect(page.getByText("Score after 90 minutes, stoppage time included.")).toBeVisible();
  const outcome = page.getByRole("group", { name: "Pick home win, draw or away win" });
  await outcome.getByRole("button", { name: "Draw" }).click();
  await expect(outcome.getByRole("button", { name: "Draw" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Lock in my picks" }).click();
  await expect(page.getByRole("status")).toContainText("Picks saved");
  await expect_fans_only(page);
  await save_screenshot(page, "22_before_football_draw");

  // Live: 2nd half, next-goal pick; no "Data says" chart for football.
  await open_sport(page, "football", "live");
  await page.getByRole("link", { name: /^KuPS vs SJK/ }).click();
  await expect(page.getByText(/LIVE · 2nd half \d+'/)).toBeVisible();
  await expect(page.getByText("Who scores the next goal?")).toBeVisible();
  await expect(page.getByText("Data says: win chance, live")).toHaveCount(0);
  await expect(page.getByText("Kick-off · pre-game picks locked")).toBeVisible();
  await expect_fans_only(page);
  await save_screenshot(page, "23_live_football");

  // Final: 1–1, the draw and the exact score are right.
  await open_sport(page, "football", "final");
  await page.getByRole("link", { name: /^KuPS vs SJK/ }).click();
  const breakdown = page.getByRole("region", { name: "Your points" });
  await expect(breakdown).toContainText("Result: draw");
  await expect(breakdown).toContainText("Exact score: you said 1–1");
  await expect(breakdown).toContainText("+35");
  await expect(page.getByText("Fans who picked a draw")).toBeVisible();
  await expect(page.getByText("AI SUMMARY")).toHaveCount(0);
  await expect_fans_only(page);
  await save_screenshot(page, "24_after_football_draw");
});

test("basketball demo replay: winner, margin band and top scorer", async ({ page }) => {
  await open_sport(page, "basketball", "before");
  await page.getByRole("link", { name: /^Karhu Basket vs Kataja Basket/ }).click();
  await expect(page.getByText("2 · Winning margin")).toBeVisible();
  await page
    .getByRole("group", { name: "Pick the winner" })
    .getByRole("button", { name: "Karhu Basket" })
    .click();
  await page
    .getByRole("group", { name: "Pick the winning margin" })
    .getByRole("button", { name: "6–10" })
    .click();
  await page
    .getByRole("group", { name: "Pick the top scorer" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Lock in my picks" }).click();
  await expect(page.getByRole("status")).toContainText("Picks saved");
  await save_screenshot(page, "25_before_basketball");

  await open_sport(page, "basketball", "live");
  await page.getByRole("link", { name: /^Karhu Basket vs Kataja Basket/ }).click();
  await expect(page.getByText(/LIVE · 3rd quarter \d\d:\d\d/)).toBeVisible();
  await expect(page.getByText("Who scores the next goal?")).toHaveCount(0);
  await expect_fans_only(page);

  await open_sport(page, "basketball", "final");
  await page.getByRole("link", { name: /^Karhu Basket vs Kataja Basket/ }).click();
  const breakdown = page.getByRole("region", { name: "Your points" });
  await expect(breakdown).toContainText("Winner: Karhu Basket");
  await expect(breakdown).toContainText("Winning margin: 6–10");
  await expect(page.getByRole("heading", { name: "Top scorer" })).toBeVisible();
  await expect_fans_only(page);
  await save_screenshot(page, "26_after_basketball");
});

test("leaderboard: Games, Hockey, Football, Basketball and Elections tabs, fans only", async ({
  page,
}) => {
  await page.goto("/leaders");
  const tabs = page.getByRole("tablist", { name: "Leaderboard" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Games",
    "Hockey",
    "Football",
    "Basketball",
    "Elections",
  ]);
  await expect(page.getByText("You vs all fans")).toBeVisible();

  await tabs.getByRole("tab", { name: "Football" }).click();
  await page.getByRole("tab", { name: "Season" }).click();
  await expect(page.getByText("MikaK_Oulu").first()).toBeVisible();
  await expect_fans_only(page);
  await save_screenshot(page, "27_leaders_football");

  await tabs.getByRole("tab", { name: "Basketball" }).click();
  await expect(page.getByText("You vs all fans")).toBeVisible();
  await expect_fans_only(page);
});
