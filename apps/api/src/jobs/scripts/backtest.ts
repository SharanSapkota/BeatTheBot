import { backtest_markdown } from "@voita_kone/prediction_model";
import { env } from "../../config/env";
import { create_liiga_client } from "../../integrations/liiga_client/create_liiga_client";
import { backtest_season } from "../backtest_season";

// Usage: tsx src/jobs/scripts/backtest.ts
// Back-tests the previous Liiga season (complete) and the current one (games played so far).
async function main(): Promise<void> {
  const liiga_client = create_liiga_client(env);
  const { season } = await liiga_client.get_tournament();
  for (const liiga_season of [season - 1, season]) {
    const started = Date.now();
    const { season: label, team_count, result } = await backtest_season(liiga_client, liiga_season);
    console.log(`\n### Liiga ${label} (${String(team_count)} teams)\n`);
    console.log(backtest_markdown(result));
    console.log(`\n_Back-test took ${String(Date.now() - started)} ms._`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
