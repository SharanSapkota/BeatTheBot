import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  election_detail_response_schema,
  election_list_response_schema,
  election_pick_response_schema,
  election_results_response_schema,
  type ElectionDetail,
  type ElectionList,
  type ElectionResults,
} from "@voita_kone/shared_types";
import { useState } from "react";
import { ApiError, api_get, api_request } from "../../lib/api_client";
import { read_session_token, useSessionToken } from "../../lib/session";
import { sign_in_device } from "../account/api";
import { elections_copy } from "./copy";

/** GET /elections: all areas (for the chips) and the visible elections. */
export function useElections() {
  return useQuery({
    queryKey: ["elections"],
    queryFn: async (): Promise<ElectionList> => {
      const response = await api_get("/elections", election_list_response_schema);
      return response.data;
    },
  });
}

/** GET /elections/:id: candidates in this user's own random order. */
export function useElection(election_id: string) {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["election", election_id, token],
    queryFn: async (): Promise<ElectionDetail> => {
      const path = `/elections/${encodeURIComponent(election_id)}`;
      const response = await api_get(path, election_detail_response_schema);
      return response.data;
    },
  });
}

export function useElectionResults(election_id: string) {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["election_results", election_id, token],
    queryFn: async (): Promise<ElectionResults> => {
      const path = `/elections/${encodeURIComponent(election_id)}/results`;
      const response = await api_get(path, election_results_response_schema);
      return response.data;
    },
  });
}

export interface PickCandidate {
  pick: (candidate_id: string) => void;
  /** The candidate being saved. */
  saving_id: string | null;
  error_text: string | null;
  /** Show the name dialog (first pick on this device). */
  is_asking_name: boolean;
  submit_name: (display_name: string) => Promise<void>;
  cancel_name: () => void;
}

/** POST (first pick) or PUT (change) the pick; asks for a display name first when signed out. */
export function usePickCandidate(election: ElectionDetail | undefined): PickCandidate {
  const query_client = useQueryClient();
  const [pending, set_pending] = useState<string | null>(null);
  const [saving_id, set_saving_id] = useState<string | null>(null);
  const [error_text, set_error_text] = useState<string | null>(null);

  const send = async (candidate_id: string, has_pick: boolean) => {
    if (!election) {
      return;
    }
    set_error_text(null);
    set_saving_id(candidate_id);
    try {
      const { data: saved } = await api_request(
        has_pick ? "PUT" : "POST",
        `/elections/${encodeURIComponent(election.id)}/picks`,
        election_pick_response_schema,
        { candidate_id },
      );
      // Show the pick at once, even if a refetch (e.g. after signing in) is still in flight.
      query_client.setQueriesData<ElectionDetail>({ queryKey: ["election", election.id] }, (old) =>
        old
          ? {
              ...old,
              my_pick: { candidate_id: saved.candidate_id, points_awarded: saved.points_awarded },
            }
          : old,
      );
    } catch (error) {
      set_error_text(
        error instanceof ApiError && error.code === "POLL_CLOSED"
          ? elections_copy.poll_closed_error
          : elections_copy.pick_failed,
      );
    }
    set_saving_id(null);
    // A fetch started before the pick (e.g. by signing in) would answer "pick first". A query
    // without data reuses an in-flight fetch on invalidate, so cancel it first: the refetch
    // then always runs after the pick.
    for (const key of ["election", "election_results"]) {
      await query_client.cancelQueries({ queryKey: [key, election.id] });
      await query_client.invalidateQueries({ queryKey: [key, election.id] });
    }
  };

  return {
    pick: (candidate_id) => {
      if (!election || !election.is_poll_open || saving_id !== null) {
        return;
      }
      if (election.my_pick?.candidate_id === candidate_id) {
        return;
      }
      if (read_session_token() === null) {
        set_pending(candidate_id);
        return;
      }
      void send(candidate_id, election.my_pick !== null);
    },
    saving_id,
    error_text,
    is_asking_name: pending !== null,
    submit_name: async (display_name) => {
      await sign_in_device(display_name);
      const waiting = pending;
      set_pending(null);
      if (waiting) {
        // A new account has no pick yet.
        await send(waiting, false);
      }
    },
    cancel_name: () => set_pending(null),
  };
}
