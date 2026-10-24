import type { RoomSummary } from "@voita_kone/shared_types";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { InlineError } from "../../components/inline_error";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { PrimaryButton } from "../../components/primary_button";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";
import { useUserSummary } from "../account/api";
import { NameDialog } from "../account/name_dialog";
import { join_room, useMyRooms, useWithAccount } from "./api";
import { rooms_copy } from "./copy";
import { JoinKeyInput } from "./join_key_input";
import styles from "./rooms_page.module.css";

function RoomRow({ room }: { room: RoomSummary }) {
  return (
    <li>
      <Link to={`/rooms/${room.id}`} className={styles.room}>
        <span className={styles.room_text}>
          <span className={styles.room_name}>
            {room.name}
            {room.is_demo && <span className={styles.badge}>{rooms_copy.demo}</span>}
            {room.status === "closed" && <span className={styles.badge}>{rooms_copy.closed}</span>}
          </span>
          <span className={styles.room_meta}>
            {rooms_copy.topics[room.topic]} · {rooms_copy.members(room.member_count)}
          </span>
        </span>
        <span className={styles.rank}>{rooms_copy.my_rank(room.my_rank)}</span>
      </Link>
    </li>
  );
}

function MyRooms() {
  const token = useSessionToken();
  const rooms = useMyRooms();
  if (token === null) {
    return <EmptyState title={rooms_copy.no_rooms_title} text={rooms_copy.no_rooms_text} />;
  }
  if (rooms.isPending) {
    return <Skeleton card_heights={[72, 72]} />;
  }
  if (rooms.isError) {
    return <ErrorState on_retry={() => void rooms.refetch()} />;
  }
  if (rooms.data.length === 0) {
    return <EmptyState title={rooms_copy.no_rooms_title} text={rooms_copy.no_rooms_text} />;
  }
  return (
    <ul className={styles.rooms} aria-label={rooms_copy.my_rooms}>
      {rooms.data.map((room) => (
        <RoomRow key={room.id} room={room} />
      ))}
    </ul>
  );
}

/** The 6-box key input and the Join button (name dialog first when signed out). */
function JoinCard() {
  const navigate = useNavigate();
  const account = useWithAccount();
  const [key, set_key] = useState("");
  const [is_joining, set_is_joining] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const join = async () => {
    set_is_joining(true);
    set_error(null);
    try {
      const room = await join_room(key);
      void navigate(`/rooms/${room.id}`);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "default";
      set_error(rooms_copy.join_errors[code] ?? rooms_copy.join_errors.default ?? "");
      set_is_joining(false);
    }
  };
  const submit = () => {
    if (key.length === 6 && !is_joining) {
      account.run(join);
    }
  };

  return (
    <Card labelled_by="join_title">
      <KalevaSectionTitle id="join_title" title={rooms_copy.join_title} mobile_variant="card" />
      <JoinKeyInput value={key} on_change={set_key} on_complete={submit} />
      {error && <InlineError text={error} />}
      <PrimaryButton on_click={submit} disabled={key.length !== 6 || is_joining}>
        {is_joining ? rooms_copy.joining : rooms_copy.join_button}
      </PrimaryButton>
      {account.is_asking_name && (
        <NameDialog
          submit_text={rooms_copy.submit_join}
          on_submit={account.submit_name}
          on_cancel={account.cancel_name}
        />
      )}
    </Card>
  );
}

/** /rooms: my rooms, "Create a room" and "Join with a key". */
export function RoomsPage() {
  const user = useUserSummary();
  const navigate = useNavigate();
  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={styles.header}>
        <h1 className={styles.title}>{rooms_copy.title}</h1>
        <p className={styles.intro}>{rooms_copy.intro}</p>
      </div>
      <PageMain>
        <PageGrid
          main={
            <GridItem mobile_order={3}>
              <KalevaSectionTitle title={rooms_copy.my_rooms} />
              <MyRooms />
            </GridItem>
          }
          sidebar={
            <>
              <GridItem mobile_order={1}>
                <PrimaryButton on_click={() => void navigate("/rooms/new")}>
                  {rooms_copy.create_button}
                </PrimaryButton>
              </GridItem>
              <GridItem mobile_order={2}>
                <JoinCard />
              </GridItem>
            </>
          }
        />
        <FooterNote text={rooms_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
