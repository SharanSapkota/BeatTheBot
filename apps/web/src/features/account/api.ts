import { useQuery } from "@tanstack/react-query";
import {
  auth_result_response_schema,
  user_summary_response_schema,
  type User,
  type UserSummary,
} from "@voita_kone/shared_types";
import { api_get, api_request } from "../../lib/api_client";
import { save_session_token, useSessionToken } from "../../lib/session";

/** Device sign-in (MVP): creates the account and keeps its token on this device. */
export async function sign_in_device(display_name: string): Promise<User> {
  const { data } = await api_request("POST", "/auth/device", auth_result_response_schema, {
    display_name,
  });
  save_session_token(data.token);
  return data.user;
}

/** The signed-in user and their total points; no request (and no data) while signed out. */
export function useUserSummary() {
  const token = useSessionToken();
  return useQuery({
    queryKey: ["me", token],
    enabled: token !== null,
    queryFn: async (): Promise<UserSummary> => {
      const response = await api_get("/me", user_summary_response_schema);
      return response.data;
    },
  });
}
