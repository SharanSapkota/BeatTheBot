import { useEffect, useState } from "react";

/** The current time, updated every `interval_ms` by one interval that is cleaned up on unmount. */
export function useNow(interval_ms = 1000): Date {
  const [now, set_now] = useState(() => new Date());
  useEffect(() => {
    const interval_id = window.setInterval(() => set_now(new Date()), interval_ms);
    return () => window.clearInterval(interval_id);
  }, [interval_ms]);
  return now;
}
