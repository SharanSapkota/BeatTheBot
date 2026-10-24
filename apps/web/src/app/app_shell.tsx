import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import styles from "./app_shell.module.css";

/** Phone-width column (max 430 px), centered on desktop. */
export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <Outlet />
    </div>
  );
}
