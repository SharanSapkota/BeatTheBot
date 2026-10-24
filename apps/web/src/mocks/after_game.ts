import type { GameDetail, Highlight, ResultQuiz, Story } from "@voita_kone/shared_types";
import { format_clock_time, format_game_time, format_score } from "../lib/format";
import {
  full_name,
  goals_of,
  is_design_demo,
  minutes_after_start,
  scorer_names,
  seeded_fraction,
  team_name_of,
} from "./sample_utils";

// Sample texts for the After screen. The design's Kärpät 3-1 Ilves texts are used as is;
// other games get texts built only from their real result and goal events.

function winner_and_loser(game: GameDetail) {
  const home_won = (game.home_goals ?? 0) > (game.away_goals ?? 0);
  return home_won
    ? { winner: game.home_team, loser: game.away_team }
    : { winner: game.away_team, loser: game.home_team };
}

function score_text(game: GameDetail): string {
  return format_score(game.home_goals ?? 0, game.away_goals ?? 0).replaceAll(" ", "");
}

// TODO(step 7): replace with GET /api/v1/games/:game_id/highlight (chosen by an editor).
export function build_sample_highlight(game: GameDetail): Highlight | null {
  if (is_design_demo(game)) {
    return {
      title: "Laine's wrist shot seals it at 51:03",
      caption:
        "Eetu Laine scores his second goal of the night to make it 3–1 and end the Ilves comeback.",
      video_url: null,
      duration_seconds: 42,
      clip_credit: "[rights holder]",
      published_at: minutes_after_start(game, 202),
    };
  }
  const { winner } = winner_and_loser(game);
  const last_winner_goal = goals_of(game)
    .filter((goal) => goal.team_id === winner.id && goal.player)
    .at(-1);
  if (!last_winner_goal?.player) {
    return null;
  }
  return {
    title: `${last_winner_goal.player.last_name}'s goal for ${winner.name} at ${format_game_time(last_winner_goal.game_time_seconds)}`,
    caption: `${full_name(last_winner_goal) ?? ""} scores for ${winner.name}, who win ${score_text(game)}.`,
    video_url: null,
    duration_seconds: 42,
    clip_credit: "[rights holder]",
    published_at: minutes_after_start(game, 202),
  };
}

// TODO(step 5): replace with GET /api/v1/games/:game_id/stories (fact-checked AI story).
export function build_sample_story(game: GameDetail): Story {
  const checked_at = format_clock_time(minutes_after_start(game, 197));
  const label_text = `AI-written from Liiga data. Checked by Kaleva sports desk, ${checked_at}.`;
  if (is_design_demo(game)) {
    return {
      id: "sample_story",
      headline: "Kärpät's relegation risk drops to 27%",
      body: "Kärpät beat Ilves 3–1 at home. The win moves them from 13th to 12th place. Their chance of relegation fell from 34% to 27%. Next up: Jukurit away on Saturday, a team two points below them.",
      label_text,
    };
  }
  const { winner, loser } = winner_and_loser(game);
  const where = winner.id === game.home_team.id ? "at home" : "away";
  const scorers = scorer_names(game).slice(0, 2);
  const scorer_line =
    scorers.length > 0 ? ` Goals came from ${scorers.join(" and ")}, among others.` : "";
  return {
    id: "sample_story",
    headline: `${winner.name} beat ${loser.name} ${score_text(game)}`,
    body: `${winner.name} beat ${loser.name} ${score_text(game)} ${where}.${scorer_line} The result changes both teams' playoff and relegation chances; the updated odds come with the prediction model.`,
    label_text,
  };
}

function rotate<T>(items: T[], seed: string): T[] {
  const shift = Math.floor(seeded_fraction(seed) * items.length);
  return [...items.slice(shift), ...items.slice(0, shift)];
}

// TODO(step 6): replace with GET /api/v1/games/:game_id/questions?phase=after.
export function build_sample_quiz(game: GameDetail): ResultQuiz {
  if (is_design_demo(game)) {
    return {
      points_each: 2,
      questions: [
        {
          id: "q1",
          prompt: "After tonight's win, what is Kärpät's chance of relegation?",
          options: ["27%", "34%", "40%"],
          correct_option: "27%",
          explanation_right:
            "Correct, +2. The win lowered the risk from 34% to 27%, because Kärpät moved above two teams in the bottom group.",
          explanation_wrong:
            "Not this time. The answer is 27%: the win lowered the risk from 34%. 40% was the risk if they had lost.",
        },
        {
          id: "q2",
          prompt: "Who scored Kärpät's first goal?",
          options: ["Eetu Laine", "Joonas Niemi", "Aleksi Mäkelä"],
          correct_option: "Eetu Laine",
          explanation_right: "Correct, +2. Laine opened the scoring at 14:37 of the 1st period.",
          explanation_wrong: "Not this time. Eetu Laine scored first, at 14:37 of the 1st period.",
        },
        {
          id: "q3",
          prompt: "How many goals were scored in the 2nd period?",
          options: ["1", "2", "3"],
          correct_option: "2",
          explanation_right: "Correct, +2. Mäkelä equalised and Niemi put Kärpät back ahead.",
          explanation_wrong:
            "Not this time. There were 2 goals: Mäkelä for Ilves and Niemi for Kärpät.",
        },
      ],
    };
  }

  const goals = goals_of(game);
  const first_goal = goals[0];
  const first_scorer = first_goal ? full_name(first_goal) : null;
  const other_names = scorer_names(game).filter((name) => name !== first_scorer);
  const total = goals.length;
  const questions: ResultQuiz["questions"] = [];

  if (first_goal && first_scorer) {
    const options = rotate([first_scorer, ...other_names.slice(0, 2)], game.id);
    questions.push({
      id: "q1",
      prompt: "Who scored the first goal of the game?",
      options: options.length >= 2 ? options : [...options, `${game.home_team.name} goalie`],
      correct_option: first_scorer,
      explanation_right: `Correct, +2. ${first_scorer} scored first for ${team_name_of(game, first_goal.team_id)}.`,
      explanation_wrong: `Not this time. ${first_scorer} scored first for ${team_name_of(game, first_goal.team_id)}.`,
    });
  }
  const wrong_counts = [total + 1, total > 0 ? total - 1 : total + 2];
  questions.push({
    id: "q2",
    prompt: "How many goals were scored in the game?",
    options: rotate([total, ...wrong_counts].map(String), `${game.id}q2`),
    correct_option: String(total),
    explanation_right: `Correct, +2. The game ended ${score_text(game)}.`,
    explanation_wrong: `Not this time. There were ${String(total)} goals: the game ended ${score_text(game)}.`,
  });
  const { winner } = winner_and_loser(game);
  questions.push({
    id: "q3",
    prompt: "Who won the game?",
    options: [game.home_team.name, game.away_team.name],
    correct_option: winner.name,
    explanation_right: `Correct, +2. ${winner.name} won ${score_text(game)}.`,
    explanation_wrong: `Not this time. ${winner.name} won ${score_text(game)}.`,
  });
  return { points_each: 2, questions };
}

/** Player-of-the-game options: the scorers, plus the home goalie. */
// TODO(step 6): replace with the player_vote question from GET /api/v1/games/:game_id/questions.
export function build_sample_vote_options(game: GameDetail): string[] {
  if (is_design_demo(game)) {
    return ["Eetu Laine", "Joonas Niemi", "Aleksi Mäkelä", "Kärpät goalie"];
  }
  return [...scorer_names(game).slice(0, 3), `${game.home_team.name} goalie`];
}
