import { describe, expect, it } from "vitest";
import { build_split, count_reactions, right_names } from "./room_reveal";

const OPTIONS = [
  { id: "a", label: "Oulu" },
  { id: "b", label: "Kuopio" },
  { id: "c", label: "Rauma" },
];

describe("build_split", () => {
  it("gives the count and share per option in the shown order", () => {
    const split = build_split(OPTIONS, [
      { option: "a" },
      { option: "a" },
      { option: "a" },
      { option: "c" },
    ]);
    expect(split).toEqual([
      { option_id: "a", count: 3, share: 0.75 },
      { option_id: "b", count: 0, share: 0 },
      { option_id: "c", count: 1, share: 0.25 },
    ]);
  });

  it("is all zeros without answers", () => {
    expect(build_split(OPTIONS, []).every((row) => row.share === 0)).toBe(true);
  });
});

describe("right_names", () => {
  const answers = [
    { option: "a", display_name: "Ville" },
    { option: "b", display_name: "Aino" },
    { option: "a", display_name: "Ärrä" },
    { option: "a", display_name: "Bertta" },
  ];

  it("lists who picked the right option, sorted", () => {
    expect(right_names("a", answers)).toEqual(["Bertta", "Ville", "Ärrä"]);
  });

  it("is empty for opinion questions", () => {
    expect(right_names(null, answers)).toEqual([]);
  });
});

describe("count_reactions", () => {
  it("counts every emoji and marks my own", () => {
    const reactions = count_reactions(
      [
        { emoji: "🔥", user_id: "me" },
        { emoji: "🔥", user_id: "other" },
        { emoji: "😂", user_id: "other" },
      ],
      "me",
    );
    expect(reactions.map((row) => row.emoji)).toEqual(["🔥", "😂", "😮", "👏", "😡"]);
    expect(reactions[0]).toEqual({ emoji: "🔥", count: 2, mine: true });
    expect(reactions[1]).toEqual({ emoji: "😂", count: 1, mine: false });
    expect(reactions[2]?.count).toBe(0);
  });
});
