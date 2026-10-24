import {
  ROOM_NAME_MAX_LENGTH,
  ROOM_TOPICS,
  create_room_request_schema,
  type RoomDetail,
  type RoomTopic,
} from "@voita_kone/shared_types";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BackLink } from "../../components/back_link";
import { BottomNav } from "../../components/bottom_nav";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { InlineError } from "../../components/inline_error";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { PageMain } from "../../components/page_main";
import { PrimaryButton } from "../../components/primary_button";
import { ApiError } from "../../lib/api_client";
import { useUserSummary } from "../account/api";
import { NameDialog } from "../account/name_dialog";
import { create_room, useWithAccount } from "./api";
import back_band from "./back_band.module.css";
import { rooms_copy } from "./copy";
import { KeyShare } from "./key_share";
import styles from "./create_room_page.module.css";

const TOPIC_CHOICES = ROOM_TOPICS.map((topic) => ({ id: topic, label: rooms_copy.topics[topic] }));

/** The success screen: the key in big letters, Copy, Share, QR code. */
function Created({ room }: { room: RoomDetail }) {
  const navigate = useNavigate();
  return (
    <Card labelled_by="created_title">
      <KalevaSectionTitle
        id="created_title"
        title={rooms_copy.created_title}
        mobile_variant="card"
      />
      <p className={styles.text}>
        <strong>{room.name}</strong> · {rooms_copy.created_text}
      </p>
      <KeyShare room_name={room.name} join_key={room.join_key} />
      <PrimaryButton on_click={() => void navigate(`/rooms/${room.id}`)}>
        {rooms_copy.open_room}
      </PrimaryButton>
    </Card>
  );
}

/** /rooms/new: name, topic, question speed. */
export function CreateRoomPage() {
  const user = useUserSummary();
  const account = useWithAccount();
  const name_id = useId();
  const [name, set_name] = useState("");
  const [topic, set_topic] = useState<RoomTopic>("hockey");
  const [speed, set_speed] = useState("300");
  const [error, set_error] = useState<string | null>(null);
  const [is_saving, set_is_saving] = useState(false);
  const [created, set_created] = useState<RoomDetail | null>(null);

  const save = async () => {
    set_is_saving(true);
    set_error(null);
    try {
      set_created(
        await create_room({ name: name.trim(), topic, question_interval_seconds: Number(speed) }),
      );
    } catch (caught) {
      set_error(
        caught instanceof ApiError && caught.code === "ROOM_LIMIT"
          ? rooms_copy.room_limit
          : rooms_copy.create_failed,
      );
    }
    set_is_saving(false);
  };

  const submit = () => {
    const parsed = create_room_request_schema.safeParse({
      name,
      topic,
      question_interval_seconds: Number(speed),
    });
    if (!parsed.success) {
      set_error(rooms_copy.name_error);
      return;
    }
    account.run(save);
  };

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={back_band.band}>
        <BackLink to="/rooms" label={rooms_copy.back} />
      </div>
      <PageMain>
        <div className={styles.column}>
          {created ? (
            <Created room={created} />
          ) : (
            <Card labelled_by="create_title">
              <KalevaSectionTitle
                id="create_title"
                level="h1"
                title={rooms_copy.create_title}
                mobile_variant="card"
              />
              <label className={styles.label} htmlFor={name_id}>
                {rooms_copy.name_label}
                <span className={styles.hint}>{rooms_copy.name_hint}</span>
              </label>
              <input
                id={name_id}
                className={styles.input}
                value={name}
                maxLength={ROOM_NAME_MAX_LENGTH}
                onChange={(event) => set_name(event.target.value)}
              />
              <p className={styles.label}>{rooms_copy.topic_label}</p>
              <ChoiceButtons
                label={rooms_copy.topic_label}
                choices={TOPIC_CHOICES}
                selected_id={topic}
                on_select={(id) => set_topic(id as RoomTopic)}
                size="medium"
                columns={2}
              />
              <p className={styles.label}>{rooms_copy.speed_label}</p>
              <ChoiceButtons
                label={rooms_copy.speed_label}
                choices={rooms_copy.speeds}
                selected_id={speed}
                on_select={set_speed}
                size="medium"
              />
              {error && <InlineError text={error} />}
              <PrimaryButton on_click={submit} disabled={is_saving}>
                {is_saving ? rooms_copy.creating : rooms_copy.create_submit}
              </PrimaryButton>
            </Card>
          )}
        </div>
      </PageMain>
      <BottomNav />
      {account.is_asking_name && (
        <NameDialog
          submit_text={rooms_copy.submit_create}
          on_submit={account.submit_name}
          on_cancel={account.cancel_name}
        />
      )}
    </>
  );
}
