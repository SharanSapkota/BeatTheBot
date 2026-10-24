import { useParams } from "react-router";
import { AppHeader } from "../../components/app_header";
import { BackLink } from "../../components/back_link";
import { BottomNav } from "../../components/bottom_nav";
import { EmptyState } from "../../components/empty_state";
import { ErrorState } from "../../components/error_state";
import { FooterNote } from "../../components/footer_note";
import { PageMain } from "../../components/page_main";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { useUserSummary } from "../account/api";
import { account_copy } from "../account/copy";
import { NameDialog } from "../account/name_dialog";
import { useElection, useElectionResults, usePickCandidate } from "./api";
import { elections_copy } from "./copy";
import { ElectionView } from "./election_view";
import styles from "./election_page.module.css";

/** /elections/:id: question, candidates in this user's random order, pick, result bars. */
export function ElectionPage() {
  const { election_id = "" } = useParams();
  const election = useElection(election_id);
  const results = useElectionResults(election_id);
  const user = useUserSummary();
  const picker = usePickCandidate(election.data);
  const is_missing = election.error instanceof ApiError && election.error.http_status === 404;

  return (
    <>
      <AppHeader total_points={user.data?.total_points} on_mobile="hidden" />
      <div className={styles.top}>
        <BackLink to="/elections" label={elections_copy.back} />
      </div>
      <PageMain>
        {election.isPending && <Skeleton card_heights={[120, 200, 200]} />}
        {is_missing && <EmptyState title={elections_copy.empty_title} />}
        {election.isError && !is_missing && <ErrorState on_retry={() => void election.refetch()} />}
        {election.data && (
          <ElectionView
            election={election.data}
            results={results.data}
            picker={picker}
            now={new Date()}
          />
        )}
        <FooterNote text={elections_copy.footer} />
      </PageMain>
      <BottomNav />
      {picker.is_asking_name && (
        <NameDialog
          submit_text={account_copy.submit_pick}
          on_submit={picker.submit_name}
          on_cancel={picker.cancel_name}
        />
      )}
    </>
  );
}
