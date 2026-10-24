import { JOIN_KEY_LENGTH } from "@voita_kone/shared_types";
import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { rooms_copy } from "./copy";
import styles from "./join_key_input.module.css";

interface JoinKeyInputProps {
  value: string;
  on_change: (value: string) => void;
  /** Enter in the last box. */
  on_complete?: () => void;
}

/** Keeps letters and digits, upper case, at most 6. */
export function clean_key(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, JOIN_KEY_LENGTH);
}

/** What was typed into a box that already held `previous` (its text is selected on focus). */
function typed_text(previous: string, value: string): string {
  return previous !== "" && value.length > 1 && value.startsWith(previous)
    ? value.slice(previous.length)
    : value;
}

/** Six big boxes, one character each; typing moves on, Backspace goes back, paste fills all. */
export function JoinKeyInput({ value, on_change, on_complete }: JoinKeyInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const characters = Array.from({ length: JOIN_KEY_LENGTH }, (_, index) => value[index] ?? "");

  const focus_box = (index: number) => {
    boxes.current[Math.max(0, Math.min(JOIN_KEY_LENGTH - 1, index))]?.focus();
  };

  const write = (index: number, typed: string) => {
    const cleaned = clean_key(typed);
    if (cleaned.length > 1) {
      // A pasted or autofilled key: fill from this box on.
      const next = clean_key(value.slice(0, index) + cleaned);
      on_change(next);
      focus_box(next.length);
      return;
    }
    const next = characters.map((character, position) =>
      position === index ? cleaned : character,
    );
    on_change(clean_key(next.join("")));
    if (cleaned.length === 1) {
      focus_box(index + 1);
    }
  };

  const on_key_down = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && characters[index] === "" && index > 0) {
      event.preventDefault();
      on_change(value.slice(0, index - 1));
      focus_box(index - 1);
    } else if (event.key === "ArrowLeft") {
      focus_box(index - 1);
    } else if (event.key === "ArrowRight") {
      focus_box(index + 1);
    } else if (event.key === "Enter") {
      on_complete?.();
    }
  };

  const on_paste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    write(index, event.clipboardData.getData("text"));
  };

  return (
    <div role="group" aria-label={rooms_copy.join_label} className={styles.boxes}>
      {characters.map((character, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={styles.box}
          value={character}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={rooms_copy.join_char(index)}
          onChange={(event) => write(index, typed_text(character, event.target.value))}
          onKeyDown={(event) => on_key_down(index, event)}
          onPaste={(event) => on_paste(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
