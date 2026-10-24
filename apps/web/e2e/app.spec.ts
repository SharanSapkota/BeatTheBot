import { expect, test, type Page } from "@playwright/test";

// The whole demo flow: hub -> Before -> lock picks -> Live -> Final -> Leaderboard, once per
// project (mobile 390 x 844, desktop 1440 x 900). The demo replays a real finished game, so it
// works at any time of day. Screenshots go to e2e/screenshots/<project>/.

async function save_screenshot(page: Page, name: string): Promise<void> {
  // Let fonts and the timeline animation settle so screenshots are comparable.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/screenshots/${project}/${name}.png`, fullPage: true });
}

async function open_hub(page: Page, moment: "before" | "live" | "final"): Promise<void> {
  await page.goto(`/?demo=1&moment=${moment}`);
  await expect(page.getByRole("heading", { name: "Today's games" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Before · 16:00/ })).toBeVisible();
}

function featured_card(page: Page) {
  return page.getByRole("link").filter({ hasText: "YOUR TEAM'S GAME" });
}

async function horizontal_overflow(page: Page): Promise<number> {
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe.configure({ mode: "serial" });

test("demo flow: hub, before, live, final, leaderboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  // 1. Hub before the games.
  await open_hub(page, "before");
  await expect(page.getByRole("button", { name: "Before · 16:00" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Demo replay")).toBeVisible();
  await expect(featured_card(page)).toContainText("Make your picks");
  await expect(featured_card(page)).toContainText(/AI's pick: .+ win · \d+%/);
  await save_screenshot(page, "01_hub_before");

  // 2. Before the game: the AI pick card.
  await featured_card(page).click();
  await expect(page).toHaveURL(/\/games\/.+demo=1&moment=before/);
  await expect(page.getByText("KALEVA AI'S PICK")).toBeVisible();
  await expect(page.getByText("Why the AI thinks so")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/Picks lock in \d\d:\d\d:\d\d/);
  await save_screenshot(page, "02_before_game");

  // Lock in picks: winner, score, scorer.
  const winner_group = page.getByRole("group", { name: "Pick the winner" });
  await winner_group.getByRole("button").first().click();
  await expect(winner_group.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: /one goal less/ })
    .first()
    .click();
  const scorers = page.getByRole("group", { name: "Pick a goal scorer" }).getByRole("button");
  await scorers.first().click();
  await page.getByRole("button", { name: "Lock in my picks" }).click();
  await expect(page.getByText(/Picks saved · edit until \d\d:\d\d/)).toBeVisible();
  await save_screenshot(page, "02_before_game_locked");

  // The saved state survives a reload (localStorage).
  await page.reload();
  await expect(page.getByText(/Picks saved · edit until/)).toBeVisible();

  // 3. Live.
  await open_hub(page, "live");
  await expect(featured_card(page)).toContainText("Make live picks");
  await save_screenshot(page, "01_hub_live");
  await featured_card(page).click();
  await expect(page.getByRole("heading", { name: "Who scores the next goal?" })).toBeVisible();
  await expect(page.getByText(/LIVE · 2nd period \d\d:\d\d/)).toBeVisible();
  await page
    .getByRole("group", { name: "Pick who scores the next goal" })
    .getByRole("button")
    .first()
    .click();
  await page
    .getByRole("group", { name: "Pick yes or no" })
    .getByRole("button", { name: "Yes" })
    .click();
  await expect(page.getByRole("heading", { name: "Game events" })).toBeVisible();
  await save_screenshot(page, "03_during_game");

  // 4. Final.
  await open_hub(page, "final");
  await expect(featured_card(page)).toContainText("See result and highlight");
  await save_screenshot(page, "01_hub_final");
  await featured_card(page).click();
  await expect(page.getByText("TONIGHT'S RESULT")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your points" })).toBeVisible();
  await expect(page.getByText("WHAT IT MEANS")).toBeVisible();
  const quiz_options = page.getByRole("group", { name: "Answer options" }).getByRole("button");
  await quiz_options.first().click();
  await expect(page.getByRole("status").filter({ hasText: /Correct|Not this time/ })).toBeVisible();
  await page
    .getByRole("group", { name: "Vote for the player of the game" })
    .getByRole("button")
    .first()
    .click();
  await save_screenshot(page, "04_after_game");

  // 5. Leaderboard. The back link reads "Game day" on mobile, "Today's games" on desktop.
  await page.getByRole("link", { name: /^(Game day|Today's games)$/ }).click();
  await page
    .getByRole("navigation", { name: "Main sections" })
    .getByRole("link", { name: "Leaders" })
    .click();
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByText("Humans vs the machine")).toBeVisible();
  await expect(page.getByText("Kaleva AI").last()).toBeVisible();
  await save_screenshot(page, "05_leaderboard");
});

test("no horizontal scroll at 360, 900 and 1440 px on any screen", async ({ page }) => {
  // The widths are set here, so one project is enough.
  test.skip(test.info().project.name !== "mobile", "runs once, in the mobile project");
  for (const width of [360, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const moment of ["before", "live", "final"] as const) {
      await open_hub(page, moment);
      expect(
        await horizontal_overflow(page),
        `hub ${moment} at ${String(width)}`,
      ).toBeLessThanOrEqual(0);
      await featured_card(page).click();
      expect(
        await horizontal_overflow(page),
        `game screen ${moment} at ${String(width)}`,
      ).toBeLessThanOrEqual(0);
    }
    await page.goto("/leaderboard?demo=1");
    expect(await horizontal_overflow(page), `leaderboard at ${String(width)}`).toBeLessThanOrEqual(
      0,
    );
  }
});

test("first lock-in on a real game asks for a name and saves the pick", async ({
  page,
  request,
}) => {
  const response = await request.get("http://localhost:3000/api/v1/games?state=upcoming");
  const body = (await response.json()) as { data: { id: string; start_time: string }[] };
  const game = body.data.find((candidate) => new Date(candidate.start_time) > new Date());
  test.skip(game === undefined, "no upcoming real game in the next days");

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`/games/${game?.id ?? ""}`);
  await page.getByRole("group", { name: "Pick the winner" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Lock in my picks" }).click();

  const dialog = page.getByRole("dialog", { name: "What should we call you?" });
  await expect(dialog).toBeVisible();
  await save_screenshot(page, "06_name_dialog");
  await dialog.getByLabel("Display name").fill(`e2e ${test.info().project.name}`);
  await dialog.getByRole("button", { name: "Save and lock in" }).click();

  await expect(page.getByText(/Picks saved · edit until \d\d:\d\d/)).toBeVisible();
  // The pick comes back from the server after clearing it on this device.
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("voita_kaleva_picks_")) {
        window.localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.getByText(/Picks saved · edit until/)).toBeVisible();

  // Clean up: the test user and its pick are deleted again (GDPR delete).
  const token = await page.evaluate(() => window.localStorage.getItem("voita_kaleva_session"));
  const deleted = await request.delete("http://localhost:3000/api/v1/me", {
    headers: { Authorization: `Bearer ${JSON.parse(token ?? '""') as string}` },
  });
  expect(deleted.status()).toBe(204);
});
