/**
 * Dashboard.tsx
 * Orchestrator and Dispatcher for Baton's Dashboard.
 * Dynamically renders DashboardLight or DashboardDark depending on active theme,
 * guaranteeing 100% clean isolation between Light and Dark styles with zero leakage.
 */

import React from "react";
import { useTheme } from "../context/ThemeContext";
import { DashboardLight } from "./DashboardLight";
import { DashboardDark } from "./DashboardDark";

export const Dashboard: React.FC<{ withLayout?: boolean }> = (props) => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <DashboardDark {...props} />;
  }

  return <DashboardLight {...props} />;
};

export default Dashboard;
