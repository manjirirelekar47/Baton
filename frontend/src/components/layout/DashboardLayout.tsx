/**
 * DashboardLayout.tsx
 * Orchestrator Shell for Baton.
 * Seamlessly dispatches to dedicated theme shells:
 * - <DashboardLayoutLight>: Pristine, high-contrast, solid white cards & frosted glass.
 * - <DashboardLayoutDark>: Deep purple/black glowing glassmorphism & radial gradient.
 * 
 * Prevents CSS class collisions, eliminates muddy grays, and guarantees zero broken card bugs.
 */

import React, { type ReactNode } from "react";
import { useTheme } from "../../context/ThemeContext";
import { DashboardLayoutLight } from "./DashboardLayoutLight";
import { DashboardLayoutDark } from "./DashboardLayoutDark";

export interface DashboardLayoutProps {
  children?: ReactNode;
  pendingReviewCount?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = (props) => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <DashboardLayoutDark {...props} />;
  }

  return <DashboardLayoutLight {...props} />;
};

export default DashboardLayout;
