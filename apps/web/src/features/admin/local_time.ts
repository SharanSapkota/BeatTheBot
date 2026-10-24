// <input type="datetime-local"> works in the browser's own time zone, without seconds.

function two(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in local time. */
export function to_local_input(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" local time → ISO instant; "" for an empty or invalid value. */
export function from_local_input(value: string): string {
  const date = new Date(value);
  return value === "" || Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** "YYYY-MM-DD" of a local day `days` from now. */
export function local_date_in(days: number, now: Date): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
