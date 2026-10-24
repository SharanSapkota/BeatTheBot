import type { KeyboardEvent } from "react";
import { class_names } from "../lib/class_names";
import styles from "./segment_tabs.module.css";

interface SegmentTabsProps<T extends string> {
  label: string;
  tabs: readonly { id: T; label: string }[];
  selected: T;
  on_change: (id: T) => void;
}

/** A row of tabs (Games / Elections, This week / Season). Arrow keys move between them. */
export function SegmentTabs<T extends string>({
  label,
  tabs,
  selected,
  on_change,
}: SegmentTabsProps<T>) {
  const on_key_down = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) {
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === selected);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      on_change(next.id);
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={styles.tabs}
      style={{ gridTemplateColumns: `repeat(${String(tabs.length)}, minmax(0, 1fr))` }}
      onKeyDown={on_key_down}
    >
      {tabs.map((tab) => {
        const is_selected = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={is_selected}
            tabIndex={is_selected ? 0 : -1}
            className={class_names(styles.tab, is_selected && styles.selected)}
            onClick={() => on_change(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
