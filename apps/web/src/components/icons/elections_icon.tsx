import type { IconProps } from "./icon_props";

/** Ballot box (Elections). */
export function ElectionsIcon({ size = 24 }: IconProps) {
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
      <path d="M4 11h16v9H4z" />
      <path d="M9 11V4h6v7" />
      <path d="M9 15h6" />
    </svg>
  );
}
