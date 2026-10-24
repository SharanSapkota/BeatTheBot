// UI text of the shared components, in one place so translations are easy later (step 7b).
export const shared_copy = {
  app_name: "VOITA KALEVA",
  app_tagline: "Fans vs fans",
  points_suffix: "pts",
  nav_label: "Main sections",
  nav_games: "Games",
  nav_elections: "Elections",
  nav_rooms: "Rooms",
  nav_leaders: "Leaders",
  demo_badge: "Demo",
  sample_badge: "Sample data",
  sport_names: { hockey: "Hockey", football: "Football", basketball: "Basketball" },
  back_to_game_day: "Game day",
  back_to_today: "Today's games",
  ai_preview: "AI PREVIEW",
  ai_summary: "AI SUMMARY",
  coming_soon: (story_type: "preview" | "summary") =>
    story_type === "preview" ? "Preview coming soon" : "Summary coming soon",
  coming_soon_text: (story_type: "preview" | "summary") =>
    story_type === "preview"
      ? "The AI preview is written from Liiga data during the week before puck drop."
      : "The AI summary is written from Liiga data after the final horn.",
  last_meetings: "Last meetings",
  corrected: (time: string, note: string) => `Corrected ${time}: ${note}`,
  report_error: "Report an error",
  report_thanks: "Thanks. The sports desk will check it.",
  report_reason_label: "What is wrong?",
  report_send: "Send report",
  report_cancel: "Cancel",
  report_failed: "The report was not sent. Check your connection and try again.",
  demo_replay: "Demo replay",
  try_again: "Try again",
  error_title: "Something went wrong",
  error_text: "We couldn't load this. Check your connection and try again.",
  loading: "Loading",
  footer_sample: "Concept demo · sample data · free to play, no real money",
} as const;
