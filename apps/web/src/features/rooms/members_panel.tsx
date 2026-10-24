import type { RoomDetail } from "@voita_kone/shared_types";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../../components/card";
import { InlineError } from "../../components/inline_error";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { initials_of } from "../../lib/format";
import { close_room, regenerate_key, remove_member } from "./api";
import { rooms_copy } from "./copy";
import styles from "./members_panel.module.css";

interface MembersPanelProps {
  room: RoomDetail;
  on_refresh: () => Promise<void>;
}

/** Members; the owner removes members, makes a new key or closes the room; others can leave. */
export function MembersPanel({ room, on_refresh }: MembersPanelProps) {
  const navigate = useNavigate();
  const [error, set_error] = useState<string | null>(null);
  const is_owner = room.my_role === "owner";
  const me = room.members.find((member) => member.is_me);

  const act = async (confirm_text: string, action: () => Promise<unknown>, after?: () => void) => {
    if (!window.confirm(confirm_text)) {
      return;
    }
    set_error(null);
    try {
      await action();
      after?.();
      await on_refresh();
    } catch {
      set_error(rooms_copy.action_failed);
    }
  };

  return (
    <Card labelled_by="room_members_title">
      <KalevaSectionTitle
        id="room_members_title"
        title={rooms_copy.members_title}
        meta={rooms_copy.members(room.member_count)}
        mobile_variant="card"
      />
      <ul className={styles.list}>
        {room.members.map((member) => (
          <li key={member.user_id} className={styles.row}>
            <span className={styles.avatar}>{initials_of(member.display_name)}</span>
            <span className={styles.name}>
              {member.display_name}
              {member.is_me && <span className={styles.you}> ({rooms_copy.you})</span>}
              {member.role === "owner" && <span className={styles.badge}>{rooms_copy.owner}</span>}
            </span>
            {is_owner && member.role !== "owner" && (
              <button
                type="button"
                className={styles.remove}
                onClick={() =>
                  void act(rooms_copy.remove_confirm(member.display_name), () =>
                    remove_member(room.id, member.user_id),
                  )
                }
              >
                {rooms_copy.remove(member.display_name)}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <InlineError text={error} />}
      {!is_owner && me && (
        <button
          type="button"
          className={styles.secondary}
          onClick={() =>
            void act(
              rooms_copy.leave_confirm,
              () => remove_member(room.id, me.user_id),
              () => void navigate("/rooms"),
            )
          }
        >
          {rooms_copy.leave}
        </button>
      )}
      {is_owner && room.status === "active" && (
        <div className={styles.tools}>
          <p className={styles.tools_title}>{rooms_copy.owner_tools}</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void act(rooms_copy.regenerate_confirm, () => regenerate_key(room.id))}
          >
            {rooms_copy.regenerate_key}
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => void act(rooms_copy.close_confirm, () => close_room(room.id))}
          >
            {rooms_copy.close_room}
          </button>
        </div>
      )}
    </Card>
  );
}
