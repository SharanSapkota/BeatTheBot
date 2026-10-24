import type { GameSummary } from "@voita_kone/shared_types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../lib/api_client";
import { useDemoMode } from "../../lib/demo_mode";
import type { GamePicks } from "../../lib/picks";
import { read_session_token } from "../../lib/session";
import { sign_in_device } from "../account/api";
import {
  from_saved_prediction,
  save_prediction,
  to_prediction_request,
  useMyPrediction,
} from "./api";
import { before_copy } from "./copy";

interface LockInOptions {
  game: GameSummary;
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
}

export interface LockIn {
  lock_in: () => void;
  is_saving: boolean;
  error_text: string | null;
  /** Show the name dialog (first lock-in on this device). */
  is_asking_name: boolean;
  submit_name: (display_name: string) => Promise<void>;
  cancel_name: () => void;
}

function error_text_of(error: unknown): string {
  if (error instanceof ApiError && error.code === "PREDICTION_LOCKED") {
    return before_copy.locked_at_start;
  }
  return before_copy.save_failed;
}

/**
 * "Lock in my picks". Real games: the pick is saved to the API (signing in with a display
 * name first if needed), and a pick saved earlier is loaded back. Demo replays: the replayed
 * game is already over, so the pick stays on this device only.
 */
export function useLockIn({ game, picks, update }: LockInOptions): LockIn {
  const { is_demo } = useDemoMode();
  const query_client = useQueryClient();
  const saved = useMyPrediction(game.id, !is_demo);
  const [is_saving, set_is_saving] = useState(false);
  const [error_text, set_error_text] = useState<string | null>(null);
  const [is_asking_name, set_is_asking_name] = useState(false);
  const has_loaded_saved = useRef(false);

  // Once per visit: a pick saved on the server shows as locked in.
  useEffect(() => {
    const prediction = saved.data;
    if (!prediction || has_loaded_saved.current) {
      return;
    }
    has_loaded_saved.current = true;
    update((current) =>
      current.locked_at !== null ? current : from_saved_prediction(current, prediction),
    );
  }, [saved.data, update]);

  const save = async () => {
    if (picks.winner_team_id === null) {
      return;
    }
    set_is_saving(true);
    set_error_text(null);
    try {
      await save_prediction(
        game.id,
        to_prediction_request(picks, picks.winner_team_id, game),
        saved.data !== undefined && saved.data !== null,
      );
      update((current) => ({ ...current, locked_at: new Date().toISOString() }));
      await query_client.invalidateQueries({ queryKey: ["my_prediction", game.id] });
    } catch (error) {
      set_error_text(error_text_of(error));
    } finally {
      set_is_saving(false);
    }
  };

  const lock_in = () => {
    if (is_demo) {
      update((current) => ({ ...current, locked_at: new Date().toISOString() }));
      return;
    }
    if (read_session_token() === null) {
      set_is_asking_name(true);
      return;
    }
    void save();
  };

  return {
    lock_in,
    is_saving,
    error_text,
    is_asking_name,
    submit_name: async (display_name: string) => {
      await sign_in_device(display_name);
      set_is_asking_name(false);
      await save();
    },
    cancel_name: () => set_is_asking_name(false),
  };
}
