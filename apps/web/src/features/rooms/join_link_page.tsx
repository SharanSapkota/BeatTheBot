import { join_key_input_schema } from "@voita_kone/shared_types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BackLink } from "../../components/back_link";
import { BottomNav } from "../../components/bottom_nav";
import { EmptyState } from "../../components/empty_state";
import { PageMain } from "../../components/page_main";
import { ApiError } from "../../lib/api_client";
import { read_session_token } from "../../lib/session";
import { sign_in_device, useUserSummary } from "../account/api";
import { NameDialog } from "../account/name_dialog";
import { join_room } from "./api";
import back_band from "./back_band.module.css";
import { rooms_copy } from "./copy";

/** /rooms/join/:key: asks for a name when there is no account, then joins and opens the room. */
export function JoinLinkPage() {
  const { key = "" } = useParams();
  const navigate = useNavigate();
  const user = useUserSummary();
  const [needs_name, set_needs_name] = useState(() => read_session_token() === null);
  const [error, set_error] = useState<string | null>(null);
  const started = useRef(false);

  const join = useCallback(async () => {
    const parsed_key = join_key_input_schema.safeParse(key);
    if (!parsed_key.success) {
      set_error(rooms_copy.join_errors.ROOM_NOT_FOUND ?? "");
      return;
    }
    try {
      const room = await join_room(parsed_key.data);
      void navigate(`/rooms/${room.id}`, { replace: true });
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "default";
      set_error(rooms_copy.join_errors[code] ?? rooms_copy.join_errors.default ?? "");
    }
  }, [key, navigate]);

  useEffect(() => {
    if (!needs_name && !started.current) {
      started.current = true;
      void join();
    }
  }, [needs_name, join]);

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={back_band.band}>
        <BackLink to="/rooms" label={rooms_copy.back} />
      </div>
      <PageMain>
        {error ? (
          <EmptyState title={rooms_copy.join_page_title} text={error} />
        ) : (
          <EmptyState title={rooms_copy.join_page_title} text={rooms_copy.join_page_text} />
        )}
      </PageMain>
      <BottomNav />
      {needs_name && (
        <NameDialog
          submit_text={rooms_copy.submit_join}
          on_submit={async (display_name) => {
            await sign_in_device(display_name);
            set_needs_name(false);
          }}
          on_cancel={() => void navigate("/rooms")}
        />
      )}
    </>
  );
}
