/** Joins CSS class names, skipping empty ones: class_names(styles.a, is_on && styles.b). */
export function class_names(...names: (string | false | null | undefined)[]): string {
  return names.filter((name): name is string => typeof name === "string" && name !== "").join(" ");
}
