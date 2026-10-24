import {
  ROOM_EMOJIS,
  type RoomOption,
  type RoomReactionCount,
  type RoomRevealedQuestion,
} from "@voita_kone/shared_types";

// The reveal of a past question: the room's split per option, who got it right, reactions.
// Pure, so the numbers are tested without a database.

export interface RevealAnswer {
  option: string;
  display_name: string;
}

/** Count and share per option, in the shown option order. Shares are 0 without answers. */
export function build_split(
  options: readonly RoomOption[],
  answers: readonly { option: string }[],
): RoomRevealedQuestion["split"] {
  const total = answers.length;
  return options.map((option) => {
    const count = answers.filter((answer) => answer.option === option.id).length;
    return { option_id: option.id, count, share: total === 0 ? 0 : count / total };
  });
}

/** Names of the members who picked the right option, A–Ö. Empty for opinion questions. */
export function right_names(
  correct_option: string | null,
  answers: readonly RevealAnswer[],
): string[] {
  if (correct_option === null) {
    return [];
  }
  return answers
    .filter((answer) => answer.option === correct_option)
    .map((answer) => answer.display_name)
    .sort((first, second) => first.localeCompare(second, "fi"));
}

/** Every emoji in the fixed order with its count and whether this user reacted with it. */
export function count_reactions(
  reactions: readonly { emoji: string; user_id: string }[],
  me_user_id: string,
): RoomReactionCount[] {
  return ROOM_EMOJIS.map((emoji) => {
    const rows = reactions.filter((reaction) => reaction.emoji === emoji);
    return {
      emoji,
      count: rows.length,
      mine: rows.some((reaction) => reaction.user_id === me_user_id),
    };
  });
}
