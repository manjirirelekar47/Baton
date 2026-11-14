/**
 * Shell.tsx
 * App Shell integrating Baton's ultra-premium frosted glassmorphism DashboardLayout.
 */

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Outlet } from "react-router-dom";

export function Shell() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

export default Shell;
