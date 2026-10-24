import { useState } from "react";
import { AppHeader } from "../../components/app_header";
import { Card } from "../../components/card";
import { ErrorState } from "../../components/error_state";
import { KalevaSectionTitle } from "../../components/kaleva_section_title";
import { PageMain } from "../../components/page_main";
import { SegmentTabs } from "../../components/segment_tabs";
import { Skeleton } from "../../components/skeleton";
import { ApiError } from "../../lib/api_client";
import { useSessionToken } from "../../lib/session";
import { useUserSummary } from "../account/api";
import { AdminElectionsTab } from "./admin_elections_tab";
import { AdminMatchesTab } from "./admin_matches_tab";
import { useAdminElections } from "./api";
import { admin_copy } from "./copy";
import styles from "./admin_page.module.css";

type AdminTab = (typeof admin_copy.tabs)[number]["id"];

function is_forbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.http_status === 401 || error.http_status === 403);
}

/** Shown when signed out or when the account is not an admin. */
function AdminsOnly({ user_id }: { user_id: string | undefined }) {
  return (
    <Card labelled_by="admins_only_title">
      <h1 id="admins_only_title">{admin_copy.admins_only_title}</h1>
      <p>{admin_copy.admins_only_text}</p>
      {user_id === undefined ? (
        <p>{admin_copy.signed_out_hint}</p>
      ) : (
        <>
          <p>{admin_copy.your_user_id(user_id)}</p>
          <p>{admin_copy.make_admin_hint}</p>
          <code className={styles.command}>{admin_copy.make_admin_command(user_id)}</code>
        </>
      )}
    </Card>
  );
}

/** /admin: desktop first, role admin. First (and for now only) tab: Elections. */
export function AdminPage() {
  const token = useSessionToken();
  const user = useUserSummary();
  const is_admin = user.data?.role === "admin";
  const elections = useAdminElections(is_admin);
  const [tab, set_tab] = useState<AdminTab>("elections");

  const header = <AppHeader total_points={user.data?.total_points} />;
  if (token !== null && user.isPending) {
    return (
      <>
        {header}
        <PageMain>
          <Skeleton card_heights={[120, 320]} />
        </PageMain>
      </>
    );
  }
  if (user.isError && !is_forbidden(user.error)) {
    return (
      <>
        {header}
        <PageMain>
          <ErrorState on_retry={() => void user.refetch()} />
        </PageMain>
      </>
    );
  }
  if (token === null || !is_admin || is_forbidden(elections.error)) {
    return (
      <>
        {header}
        <PageMain>
          <AdminsOnly user_id={token === null ? undefined : user.data?.id} />
        </PageMain>
      </>
    );
  }

  return (
    <>
      {header}
      <PageMain>
        <KalevaSectionTitle title={admin_copy.title} meta={admin_copy.meta} level="h1" />
        <SegmentTabs
          label={admin_copy.tabs_label}
          tabs={admin_copy.tabs}
          selected={tab}
          on_change={set_tab}
        />
        {tab === "elections" && elections.isPending && <Skeleton card_heights={[120, 320]} />}
        {tab === "elections" && elections.isError && (
          <ErrorState on_retry={() => void elections.refetch()} />
        )}
        {elections.data && tab === "elections" && <AdminElectionsTab elections={elections.data} />}
        {tab === "matches" && <AdminMatchesTab />}
      </PageMain>
    </>
  );
}
