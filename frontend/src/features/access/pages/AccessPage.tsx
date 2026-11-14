/**
 * AccessPage.tsx
 * Theme-aware Dispatcher for Baton's Access Control & Permissions.
 */

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { AccessPageLight } from "./AccessPageLight";
import { AccessPageDark } from "./AccessPageDark";

export const AccessPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <AccessPageDark />;
  }

  return <AccessPageLight />;
};

export default AccessPage;
