import type { IconProps } from "./icon_props";

/** Hockey puck and stick (Games). */
export function GamesIcon({ size = 24 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3l7 13h7" />
      <ellipse cx="7" cy="18" rx="4" ry="2" />
    </svg>
  );
}
