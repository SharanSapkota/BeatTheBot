import type { ElectionSummary } from "@voita_kone/shared_types";
import { useState } from "react";
import { Link } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BottomNav } from "../../components/bottom_nav";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { class_names } from "../../lib/class_names";
import { useDemoMode } from "../../lib/demo_mode";
import { useUserSummary } from "../account/api";
import { useElections } from "./api";
import { elections_copy } from "./copy";
import { ElectionMeta } from "./election_meta";
import styles from "./elections_page.module.css";

const DEFAULT_AREA = "Oulu";
/** The "All areas" chip. */
const ALL = null;

function ElectionCard({ election, now }: { election: ElectionSummary; now: Date }) {
  const { link_to } = useDemoMode();
  return (
    <li>
      <Link to={link_to(`/elections/${election.id}`)} className={styles.card}>
        <span className={styles.type}>{elections_copy.type_label(election.election_type)}</span>
        <span className={styles.card_title}>{election.title}</span>
        <span className={styles.question}>{election.question_text}</span>
        <ElectionMeta election={election} now={now} />
        <span className={styles.count}>
          {elections_copy.candidates_count(election.candidate_count)}
        </span>
      </Link>
    </li>
  );
}

/** /elections: the published elections, upcoming first, with filter chips by area. */
export function ElectionsPage() {
  const elections = useElections();
  const user = useUserSummary();
  /** undefined until the user taps a chip; then the chip's area (null = all areas). */
  const [chosen_area, set_area] = useState<string | null | undefined>(undefined);
  const areas = elections.data?.areas;
  // Default chip: "Oulu" when there is such an area, else all areas.
  const area =
    chosen_area !== undefined ? chosen_area : areas?.includes(DEFAULT_AREA) ? DEFAULT_AREA : ALL;

  const now = new Date();
  const shown = (elections.data?.elections ?? []).filter(
    (election) => area === ALL || election.area_name === area,
  );
  const chips: { id: string | null; label: string }[] = [
    { id: ALL, label: elections_copy.all_areas },
    ...(areas ?? []).map((name) => ({ id: name, label: name })),
  ];

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={styles.header}>
        <h1 className={styles.title}>{elections_copy.title}</h1>
        <p className={styles.intro}>{elections_copy.intro}</p>
      </div>
      <PageMain>
        {elections.isPending && <Skeleton card_heights={[44, 160, 160]} />}
        {elections.isError && <ErrorState on_retry={() => void elections.refetch()} />}
        {elections.data && (
          <>
            {chips.length > 1 && (
              <div className={styles.chips} role="group" aria-label={elections_copy.area_group}>
                {chips.map((chip) => (
                  <button
                    key={chip.id ?? "all"}
                    type="button"
                    className={class_names(styles.chip, area === chip.id && styles.chip_selected)}
                    aria-pressed={area === chip.id}
                    onClick={() => set_area(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <EmptyState title={elections_copy.empty_title} text={elections_copy.empty_text} />
            ) : (
              <ul className={styles.list} aria-label={elections_copy.list_label}>
                {shown.map((election) => (
                  <ElectionCard key={election.id} election={election} now={now} />
                ))}
              </ul>
            )}
          </>
        )}
        <FooterNote text={elections_copy.footer} />
      </PageMain>
      <BottomNav />
    </>
  );
}
