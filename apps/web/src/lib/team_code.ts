import type { TeamSummary } from "@voita_kone/shared_types";

const MAX_CODE_LENGTH = 4;
const CODE_LENGTH = 3;

/**
 * Badge code as in the design: "KÄR", "ILV", "HIFK". Liiga's abbreviation is often the full
 * name ("KÄRPÄT"), so longer ones are cut to their first three letters.
 */
export function team_code(team: Pick<TeamSummary, "short_name">): string {
  const letters = team.short_name.toUpperCase().replace(/[^\p{L}\d]/gu, "");
  return letters.length <= MAX_CODE_LENGTH ? letters : letters.slice(0, CODE_LENGTH);
}
