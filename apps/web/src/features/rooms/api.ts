import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  room_answer_response_schema,
  room_current_response_schema,
  room_detail_response_schema,
  room_leaderboard_response_schema,
  room_questions_response_schema,
  room_reactions_response_schema,
  room_summaries_response_schema,
  type CreateRoomRequest,
  type RoomCurrent,
  type RoomDetail,
  type RoomEmoji,
  type RoomLeaderboard,
  type RoomLeaderboardPeriod,
  type RoomRevealedQuestion,
  type RoomSummary,
} from "@voita_kone/shared_types";
import { useCallback, useState } from "react";
import { z } from "zod";
import { api_get, api_request } from "../../lib/api_client";
import { read_session_token, useSessionToken } from "../../lib/session";
import { sign_in_device } from "../account/api";

/** Live updates: polling every 5 s while the page is visible (paused when hidden). */
export const ROOM_POLL_MS = 5000;
const PAST_LIMIT = 5;

const room_path = (room_id: string) => `/rooms/${encodeURIComponent(room_id)}`;

/** GET /me/rooms; nothing while signed out. */
export function useMyRooms() {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["my_rooms", token],
    enabled: token !== null,
    queryFn: async (): Promise<RoomSummary[]> =>
      (await api_get("/me/rooms", room_summaries_response_schema)).data,
  });
}

export function useRoom(room_id: string) {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["room", room_id, token],
    enabled: token !== null,
    refetchInterval: ROOM_POLL_MS,
    queryFn: async (): Promise<RoomDetail> =>
      (await api_get(room_path(room_id), room_detail_response_schema)).data,
  });
}

export function useCurrentQuestion(room_id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["room_current", room_id],
    enabled,
    refetchInterval: ROOM_POLL_MS,
    queryFn: async (): Promise<RoomCurrent> =>
      (await api_get(`${room_path(room_id)}/current_question`, room_current_response_schema)).data,
  });
}

export function usePastQuestions(room_id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["room_past", room_id],
    enabled,
    refetchInterval: ROOM_POLL_MS,
    queryFn: async (): Promise<RoomRevealedQuestion[]> =>
      (
        await api_get(
          `${room_path(room_id)}/questions?limit=${String(PAST_LIMIT)}`,
          room_questions_response_schema,
        )
      ).data,
  });
}

export function useRoomLeaderboard(
  room_id: string,
  period: RoomLeaderboardPeriod,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["room_leaderboard", room_id, period],
    enabled,
    refetchInterval: ROOM_POLL_MS,
    queryFn: async (): Promise<RoomLeaderboard> =>
      (
        await api_get(
          `${room_path(room_id)}/leaderboard?period=${period}`,
          room_leaderboard_response_schema,
        )
      ).data,
  });
}

/** Everything inside one room, after an answer, a reveal or a member change. */
export function useRefreshRoom(room_id: string) {
  const query_client = useQueryClient();
  return useCallback(async () => {
    await Promise.all(
      ["room", "room_current", "room_past", "room_leaderboard"].map((key) =>
        query_client.invalidateQueries({ queryKey: [key, room_id] }),
      ),
    );
    await query_client.invalidateQueries({ queryKey: ["my_rooms"] });
  }, [query_client, room_id]);
}

export async function create_room(request: CreateRoomRequest): Promise<RoomDetail> {
  return (await api_request("POST", "/rooms", room_detail_response_schema, request)).data;
}

export async function join_room(key: string): Promise<RoomDetail> {
  return (await api_request("POST", "/rooms/join", room_detail_response_schema, { key })).data;
}

export async function answer_question(question_id: string, option: string): Promise<void> {
  await api_request(
    "POST",
    `/room_questions/${encodeURIComponent(question_id)}/answers`,
    room_answer_response_schema,
    { option },
  );
}

export async function toggle_reaction(question_id: string, emoji: RoomEmoji) {
  return (
    await api_request(
      "POST",
      `/room_questions/${encodeURIComponent(question_id)}/reactions`,
      room_reactions_response_schema,
      { emoji },
    )
  ).data;
}

export async function remove_member(room_id: string, user_id: string): Promise<void> {
  await api_request(
    "DELETE",
    `${room_path(room_id)}/members/${encodeURIComponent(user_id)}`,
    z.null(),
  );
}

export async function regenerate_key(room_id: string): Promise<RoomDetail> {
  return (
    await api_request("POST", `${room_path(room_id)}/regenerate_key`, room_detail_response_schema)
  ).data;
}

export async function close_room(room_id: string): Promise<RoomDetail> {
  return (await api_request("POST", `${room_path(room_id)}/close`, room_detail_response_schema))
    .data;
}

export interface WithAccount {
  /** Runs the action now, or after the name dialog when signed out. */
  run: (action: () => Promise<void>) => void;
  is_asking_name: boolean;
  submit_name: (display_name: string) => Promise<void>;
  cancel_name: () => void;
}

/** The first room action on this device asks for a display name (device sign-in). */
export function useWithAccount(): WithAccount {
  const [pending, set_pending] = useState<(() => Promise<void>) | null>(null);
  return {
    run: (action) => {
      if (read_session_token() === null) {
        set_pending(() => action);
        return;
      }
      void action();
    },
    is_asking_name: pending !== null,
    submit_name: async (display_name) => {
      await sign_in_device(display_name);
      const waiting = pending;
      set_pending(null);
      if (waiting) {
        await waiting();
      }
    },
    cancel_name: () => set_pending(null),
  };
}
