import type { RoomDetail } from "@voita_kone/shared_types";
import { useState } from "react";
import { useParams } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BackLink } from "../../components/back_link";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { GridItem, PageGrid } from "../../components/page_grid";
import { PageMain } from "../../components/page_main";
import { SegmentTabs } from "../../components/segment_tabs";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";
import { useUserSummary } from "../account/api";
import { useCurrentQuestion, usePastQuestions, useRefreshRoom, useRoom } from "./api";
import back_band from "./back_band.module.css";
import { rooms_copy } from "./copy";
import { KeyShare } from "./key_share";
import { MembersPanel } from "./members_panel";
import { QuestionCard } from "./question_card";
import { RevealedQuestion } from "./revealed_question";
import { RoomScoreboard } from "./room_scoreboard";
import styles from "./room_page.module.css";

type RoomTab = (typeof rooms_copy.tabs)[number]["id"];

/** The current question card and the last revealed questions. */
function QuestionTab({ room, on_refresh }: { room: RoomDetail; on_refresh: () => Promise<void> }) {
  const current = useCurrentQuestion(room.id, true);
  const past = usePastQuestions(room.id, true);
  return (
    <div className={styles.stack}>
      {current.isPending && <Skeleton card_heights={[260]} />}
      {current.isError && <ErrorState on_retry={() => void current.refetch()} />}
      {current.data?.question === null && <EmptyState title={rooms_copy.no_question} />}
      {current.data?.question && (
        <QuestionCard
          key={current.data.question.id}
          question={current.data.question}
          fetched_at={current.dataUpdatedAt}
          on_refresh={on_refresh}
        />
      )}
      <Card labelled_by="room_past_title">
        <KalevaSectionTitle
          id="room_past_title"
          title={rooms_copy.past_title}
          mobile_variant="card"
        />
        {past.data?.length === 0 && <p className={styles.muted}>{rooms_copy.no_past}</p>}
        {past.data?.map((question) => (
          <RevealedQuestion key={question.id} question={question} />
        ))}
      </Card>
    </div>
  );
}

function RoomHeader({ room }: { room: RoomDetail }) {
  const [is_sharing, set_is_sharing] = useState(false);
  return (
    <div className={styles.header}>
      <div className={styles.header_row}>
        <div className={styles.header_text}>
          <h1 className={styles.title}>{room.name}</h1>
          <p className={styles.header_meta}>
            {rooms_copy.topics[room.topic]} · {rooms_copy.members(room.member_count)}
            {room.status === "closed" && <> · {rooms_copy.closed}</>}
          </p>
        </div>
        <button
          type="button"
          className={styles.share_button}
          aria-expanded={is_sharing}
          onClick={() => set_is_sharing((open) => !open)}
        >
          <span className={styles.key_small}>{room.join_key}</span>
          {is_sharing ? rooms_copy.close_share : rooms_copy.share_room}
        </button>
      </div>
      {is_sharing && (
        <div className={styles.share_sheet}>
          <KeyShare room_name={room.name} join_key={room.join_key} />
        </div>
      )}
    </div>
  );
}

/**
 * /rooms/:id: header (name, members, key + share), tabs Question · Scoreboard · Members.
 * Desktop: the question (and members) in the main column, the scoreboard in the sidebar.
 */
export function RoomPage() {
  const { room_id = "" } = useParams();
  const token = useSessionToken();
  const user = useUserSummary();
  const room = useRoom(room_id);
  const on_refresh = useRefreshRoom(room_id);
  const [tab, set_tab] = useState<RoomTab>("question");
  const error_code = room.error instanceof ApiError ? room.error.code : null;

  /** On mobile only the selected tab shows; from 900 px every section shows. */
  const shown_on_mobile = (section: RoomTab) => (tab === section ? undefined : "desktop_only");

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={back_band.band}>
        <BackLink to="/rooms" label={rooms_copy.back} />
      </div>
      {room.data && <RoomHeader room={room.data} />}
      <PageMain>
        {token === null && (
          <EmptyState title={rooms_copy.not_member_title} text={rooms_copy.not_member_text} />
        )}
        {token !== null && room.isPending && <Skeleton card_heights={[260, 200]} />}
        {error_code === "NOT_A_MEMBER" && (
          <EmptyState title={rooms_copy.not_member_title} text={rooms_copy.not_member_text} />
        )}
        {error_code === "ROOM_NOT_FOUND" && <EmptyState title={rooms_copy.missing_title} />}
        {room.isError && error_code !== "NOT_A_MEMBER" && error_code !== "ROOM_NOT_FOUND" && (
          <ErrorState on_retry={() => void room.refetch()} />
        )}
        {room.data && (
          <>
            <div className="mobile_only">
              <SegmentTabs
                label={rooms_copy.tabs_label}
                tabs={rooms_copy.tabs}
                selected={tab}
                on_change={set_tab}
              />
            </div>
            <PageGrid
              main={
                <>
                  <GridItem mobile_order={1}>
                    <div className={shown_on_mobile("question")}>
                      <QuestionTab room={room.data} on_refresh={on_refresh} />
                    </div>
                  </GridItem>
                  <GridItem mobile_order={3}>
                    <div className={shown_on_mobile("members")}>
                      <MembersPanel room={room.data} on_refresh={on_refresh} />
                    </div>
                  </GridItem>
                </>
              }
              sidebar={
                <GridItem mobile_order={2}>
                  <div className={shown_on_mobile("scoreboard")}>
                    <RoomScoreboard room_id={room.data.id} />
                  </div>
                </GridItem>
              }
            />
          </>
        )}
        <FooterNote text={rooms_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
