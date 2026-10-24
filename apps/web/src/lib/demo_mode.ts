import { replay_moment_schema, type ReplayMoment } from "@voita_kone/shared_types";
import { useSearchParams } from "react-router";

// Demo mode replays a real finished game at a chosen moment (GET /api/v1/demo/...), so the
// whole flow can be shown at any time of day. It is on with VITE_DEMO_MODE=true or ?demo=1,
// and the moment lives in the URL (?moment=live) so links keep it.

export interface DemoMode {
  is_demo: boolean;
  moment: ReplayMoment;
  /** Adds the current demo params to an app path. */
  link_to: (path: string) => string;
}

export function is_demo_env(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

export function read_demo_mode(search_params: URLSearchParams): DemoMode {
  const is_demo = is_demo_env() || search_params.get("demo") === "1";
  const parsed_moment = replay_moment_schema.safeParse(search_params.get("moment"));
  const moment = parsed_moment.success ? parsed_moment.data : "before";

  const link_to = (path: string) => {
    if (!is_demo) {
      return path;
    }
    const params = new URLSearchParams({ demo: "1", moment });
    return `${path}?${params.toString()}`;
  };
  return { is_demo, moment, link_to };
}

export function useDemoMode(): DemoMode {
  const [search_params] = useSearchParams();
  return read_demo_mode(search_params);
}
