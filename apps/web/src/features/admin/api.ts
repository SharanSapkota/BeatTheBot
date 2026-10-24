import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  admin_election_response_schema,
  admin_elections_response_schema,
  admin_leagues_response_schema,
  admin_match_response_schema,
  admin_matches_response_schema,
  type AdminCandidateInput,
  type AdminElection,
  type AdminElectionInput,
  type AdminLeague,
  type AdminMatch,
  type AdminMatchInput,
  type AdminMatchResultRequest,
} from "@voita_kone/shared_types";
import { z } from "zod";
import { api_get, api_request } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";

const ADMIN_KEY = "admin_elections";

/** GET /admin/elections: every election, drafts too. */
export function useAdminElections(enabled: boolean) {
  const token = useSessionToken();
  return useQuery({
    queryKey: [ADMIN_KEY, token],
    enabled: enabled && token !== null,
    queryFn: async (): Promise<AdminElection[]> => {
      const response = await api_get("/admin/elections", admin_elections_response_schema);
      return response.data;
    },
  });
}

export type AdminAction =
  | { kind: "create"; body: AdminElectionInput }
  | { kind: "update"; election_id: string; body: AdminElectionInput }
  | { kind: "delete"; election_id: string }
  | { kind: "add_candidate"; election_id: string; body: AdminCandidateInput }
  | {
      kind: "update_candidate";
      election_id: string;
      candidate_id: string;
      body: AdminCandidateInput;
    }
  | { kind: "delete_candidate"; election_id: string; candidate_id: string }
  | { kind: "publish" | "close"; election_id: string }
  | {
      kind: "result";
      election_id: string;
      body: { winner_candidate_id: string; vote_counts: Record<string, number> | null };
    };

/** DELETE answers 204 without a body. */
const no_content_schema = z.null();

/** Sends one admin change; returns the changed election (null after a delete). */
async function send_admin_action(action: AdminAction): Promise<AdminElection | null> {
  const base = "/admin/elections";
  switch (action.kind) {
    case "create":
      return (await api_request("POST", base, admin_election_response_schema, action.body)).data;
    case "update":
      return (
        await api_request(
          "PUT",
          `${base}/${action.election_id}`,
          admin_election_response_schema,
          action.body,
        )
      ).data;
    case "delete":
      await api_request("DELETE", `${base}/${action.election_id}`, no_content_schema);
      return null;
    case "add_candidate":
      return (
        await api_request(
          "POST",
          `${base}/${action.election_id}/candidates`,
          admin_election_response_schema,
          action.body,
        )
      ).data;
    case "update_candidate":
      return (
        await api_request(
          "PUT",
          `${base}/${action.election_id}/candidates/${action.candidate_id}`,
          admin_election_response_schema,
          action.body,
        )
      ).data;
    case "delete_candidate":
      await api_request(
        "DELETE",
        `${base}/${action.election_id}/candidates/${action.candidate_id}`,
        no_content_schema,
      );
      return null;
    case "publish":
    case "close":
      return (
        await api_request(
          "POST",
          `${base}/${action.election_id}/${action.kind}`,
          admin_election_response_schema,
        )
      ).data;
    case "result":
      return (
        await api_request(
          "POST",
          `${base}/${action.election_id}/result`,
          admin_election_response_schema,
          action.body,
        )
      ).data;
  }
}

/** Runs an admin change, then reloads the admin list and the users' election list. */
export function useAdminAction() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: send_admin_action,
    onSuccess: async () => {
      await query_client.invalidateQueries({ queryKey: [ADMIN_KEY] });
      await query_client.invalidateQueries({ queryKey: ["elections"] });
    },
  });
}

const MATCHES_KEY = "admin_matches";

/** GET /admin/leagues: football and basketball leagues with their teams. */
export function useAdminLeagues(enabled: boolean) {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["admin_leagues", token],
    enabled: enabled && token !== null,
    queryFn: async (): Promise<AdminLeague[]> =>
      (await api_get("/admin/leagues", admin_leagues_response_schema)).data,
  });
}

/** GET /admin/matches: every football and basketball match, newest first. */
export function useAdminMatches(enabled: boolean) {
  const token = useSessionToken();
  return useQuery({
    queryKey: [MATCHES_KEY, token],
    enabled: enabled && token !== null,
    queryFn: async (): Promise<AdminMatch[]> =>
      (await api_get("/admin/matches", admin_matches_response_schema)).data,
  });
}

export type AdminMatchAction =
  | { kind: "create"; body: AdminMatchInput }
  | { kind: "update"; match_id: string; body: AdminMatchInput }
  | { kind: "delete"; match_id: string }
  | { kind: "result"; match_id: string; body: AdminMatchResultRequest };

/** Sends one match change; returns the changed match (null after a delete). */
async function send_match_action(action: AdminMatchAction): Promise<AdminMatch | null> {
  const base = "/admin/matches";
  switch (action.kind) {
    case "create":
      return (await api_request("POST", base, admin_match_response_schema, action.body)).data;
    case "update":
      return (
        await api_request(
          "PUT",
          `${base}/${action.match_id}`,
          admin_match_response_schema,
          action.body,
        )
      ).data;
    case "delete":
      await api_request("DELETE", `${base}/${action.match_id}`, no_content_schema);
      return null;
    case "result":
      return (
        await api_request(
          "POST",
          `${base}/${action.match_id}/result`,
          admin_match_response_schema,
          action.body,
        )
      ).data;
  }
}

/** Runs a match change, then reloads the admin list, the hub, the sport tabs and the leaderboard. */
export function useAdminMatchAction() {
  const query_client = useQueryClient();
  return useMutation({
    mutationFn: send_match_action,
    onSuccess: async () => {
      await Promise.all(
        [MATCHES_KEY, "game_day", "sports", "leaderboard"].map((key) =>
          query_client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
