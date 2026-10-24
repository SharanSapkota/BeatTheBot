import type { Transaction } from "kysely";
import { score_room_answer } from "@voita_kone/scoring";
import { MockQuestionGenerator } from "../../modules/rooms/mock_question_generator";
import type { DB } from "../database_types";

// The demo room "Kärpät fans Oulu" (key DEMO26, a new question every 60 s) with 8 demo members
// and 12 past questions they answered, so the room scoreboard is full. Demo room points never
// count on the global leaderboard (room points never do).

export const DEMO_ROOM = {
  name: "Kärpät fans Oulu",
  topic: "hockey",
  // Seeded on purpose: has an "O", which generated keys never use.
  join_key: "DEMO26",
  question_interval_seconds: 60,
  is_demo: true,
} as const;

/** provider_subject prefix of the demo members' device identities. */
export const DEMO_ROOM_DEVICE_PREFIX = "demo_device_room_";
export const DEMO_ROOM_PAST_QUESTIONS = 12;

/** Fictional members; `skill` = out of 10 trivia questions, how many they get right. */
// prettier-ignore
export const DEMO_ROOM_MEMBERS: readonly { display_name: string; skill: number }[] = [
  { display_name: "Kärppä-Kalle", skill: 8 },
  { display_name: "Tuiran Tiina", skill: 7 },
  { display_name: "Hanna H.", skill: 7 },
  { display_name: "Raksilan Riku", skill: 6 },
  { display_name: "Oulun Olli", skill: 5 },
  { display_name: "Saara S.", skill: 5 },
  { display_name: "Pekka P.", skill: 4 },
  { display_name: "Mikko M.", skill: 3 },
];

/** Removes the demo rooms (cascades to members, questions, answers, reactions) and their members. */
export async function delete_demo_room(trx: Transaction<DB>): Promise<void> {
  await trx.deleteFrom("rooms").where("is_demo", "=", true).execute();
  const members = trx
    .selectFrom("auth_identities")
    .select("user_id")
    .where("provider", "=", "device")
    .where("provider_subject", "like", `${DEMO_ROOM_DEVICE_PREFIX}%`);
  await trx.deleteFrom("users").where("id", "in", members).execute();
}

/** Deterministic: member i answers question j right when (3i + 7j) mod 10 < skill. */
function answers_right(member_index: number, question_index: number, skill: number): boolean {
  return (member_index * 3 + question_index * 7) % 10 < skill;
}

/** Inserts the demo room, its members and their past answers. Returns the answer count. */
export async function insert_demo_room(trx: Transaction<DB>, now: Date): Promise<number> {
  const interval_ms = DEMO_ROOM.question_interval_seconds * 1000;
  // The current slot is DEMO_ROOM_PAST_QUESTIONS; every earlier slot has a revealed question.
  const created_at = new Date(now.getTime() - DEMO_ROOM_PAST_QUESTIONS * interval_ms - 1000);

  const user_ids: string[] = [];
  for (const [index, member] of DEMO_ROOM_MEMBERS.entries()) {
    const { id } = await trx
      .insertInto("users")
      .values({ display_name: member.display_name, role: "user" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("auth_identities")
      .values({
        user_id: id,
        provider: "device",
        provider_subject: `${DEMO_ROOM_DEVICE_PREFIX}${String(index + 1).padStart(2, "0")}`,
      })
      .execute();
    user_ids.push(id);
  }
  const owner_id = user_ids[0] as string;

  const { id: room_id } = await trx
    .insertInto("rooms")
    .values({ ...DEMO_ROOM, owner_id, created_at, schedule_started_at: created_at })
    .returning("id")
    .executeTakeFirstOrThrow();
  await trx
    .insertInto("room_members")
    .values(
      user_ids.map((user_id, index) => ({
        room_id,
        user_id,
        role: index === 0 ? "owner" : "member",
        joined_at: created_at,
      })),
    )
    .execute();

  const generator = new MockQuestionGenerator();
  const used_prompts: string[] = [];
  let answer_count = 0;
  for (let slot = 0; slot < DEMO_ROOM_PAST_QUESTIONS; slot += 1) {
    const question = await generator.generate({
      topic: DEMO_ROOM.topic,
      used_prompts,
      seed: `${room_id}:${String(slot)}`,
    });
    used_prompts.push(question.prompt);
    const opens_at = new Date(created_at.getTime() + slot * interval_ms);
    const { id: question_id } = await trx
      .insertInto("room_questions")
      .values({
        room_id,
        slot_index: slot,
        question_type: question.question_type,
        prompt: question.prompt,
        options: JSON.stringify(question.options),
        correct_option: question.correct_option,
        points: question.points,
        opens_at,
        locks_at: new Date(opens_at.getTime() + interval_ms),
        source: question.source,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const rows = DEMO_ROOM_MEMBERS.flatMap((member, member_index) => {
      // Everyone skips now and then.
      if ((member_index + slot) % 5 === 4) {
        return [];
      }
      const option_ids = question.options.map((option) => option.id);
      const wrong = option_ids.filter((id) => id !== question.correct_option);
      const option =
        question.correct_option !== null && answers_right(member_index, slot, member.skill)
          ? question.correct_option
          : (wrong[(member_index + slot) % wrong.length] ?? option_ids[0] ?? "a");
      return [
        {
          question_id,
          user_id: user_ids[member_index] as string,
          option,
          points_awarded: score_room_answer(question, option),
          created_at: new Date(opens_at.getTime() + (member_index + 1) * 3000),
        },
      ];
    });
    if (rows.length > 0) {
      await trx.insertInto("room_answers").values(rows).execute();
      answer_count += rows.length;
    }
    // A few reactions on the revealed questions.
    await trx
      .insertInto("room_reactions")
      .values(
        user_ids
          .filter((_, member_index) => (member_index + slot) % 3 === 0)
          .map((user_id, index) => ({
            question_id,
            user_id,
            emoji: ["🔥", "😂", "👏", "😮"][(index + slot) % 4] as string,
          })),
      )
      .execute();
  }
  return answer_count;
}
