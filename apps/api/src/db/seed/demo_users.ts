export const FALLBACK_EDITOR_EMAIL = "editor@voitakone.local";

export interface DemoUser {
  /** provider_subject of the user's 'device' identity. */
  device_id: string;
  display_name: string;
  role: "user" | "editor";
  email: string | null;
  preferred_language: "fi" | "sv" | "en";
  is_subscriber: boolean;
}

/** A finished game the demo users predicted, with one goal scorer per team if known. */
export interface PredictionTarget {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
  home_scorer_id: string | null;
  away_scorer_id: string | null;
}

export interface DemoPrediction {
  device_id: string;
  game_id: string;
  predicted_winner_team_id: string;
  predicted_home_goals: number;
  predicted_away_goals: number;
  predicted_scorer_id: string | null;
}

// prettier-ignore
export function build_demo_users(editor_email: string): DemoUser[] {
  return [
    { device_id: "demo_device_editor", display_name: "Kaleva urheilutoimitus", role: "editor", email: editor_email.toLowerCase(), preferred_language: "fi", is_subscriber: true },
    { device_id: "demo_device_mika", display_name: "MikaK_Oulu", role: "user", email: null, preferred_language: "fi", is_subscriber: true },
    { device_id: "demo_device_sanna", display_name: "sanna.l", role: "user", email: null, preferred_language: "fi", is_subscriber: false },
    { device_id: "demo_device_jani", display_name: "TappaJani", role: "user", email: null, preferred_language: "fi", is_subscriber: true },
    { device_id: "demo_device_erik", display_name: "Erik_Vaasa", role: "user", email: null, preferred_language: "sv", is_subscriber: false },
    { device_id: "demo_device_hannah", display_name: "HockeyHannah", role: "user", email: null, preferred_language: "en", is_subscriber: false },
  ];
}

/**
 * Picks for one finished game: some exactly right, some partly, some wrong, so the
 * leaderboard has a spread. points_awarded stays empty: the scoring job fills it.
 */
export function build_demo_predictions(target: PredictionTarget): DemoPrediction[] {
  const home_won = target.home_goals > target.away_goals;
  const winner = home_won ? "home" : "away";
  const team_id = { home: target.home_team_id, away: target.away_team_id };
  const scorer_id = { home: target.home_scorer_id, away: target.away_scorer_id };
  const loser = winner === "home" ? "away" : "home";
  const winner_goals = Math.max(target.home_goals, target.away_goals);
  const loser_goals = Math.min(target.home_goals, target.away_goals);

  // Builds a pick where `side` wins with the given goals, oriented as home-away.
  const pick = (
    device_id: string,
    side: "home" | "away",
    side_goals: number,
    other_goals: number,
    predicted_scorer_id: string | null,
  ): DemoPrediction => ({
    device_id,
    game_id: target.game_id,
    predicted_winner_team_id: team_id[side],
    predicted_home_goals: side === "home" ? side_goals : other_goals,
    predicted_away_goals: side === "home" ? other_goals : side_goals,
    predicted_scorer_id,
  });

  return [
    pick("demo_device_mika", winner, winner_goals, loser_goals, scorer_id[winner]), // exact score + scorer
    pick("demo_device_sanna", winner, winner_goals + 1, loser_goals, scorer_id[winner]), // winner + scorer
    pick("demo_device_jani", loser, 3, 2, scorer_id[loser]), // wrong winner, maybe right scorer
    pick("demo_device_erik", loser, 2, 1, null), // wrong
    pick("demo_device_hannah", winner, winner_goals + 1, loser_goals + 1, scorer_id[winner]), // winner + scorer
  ];
}
