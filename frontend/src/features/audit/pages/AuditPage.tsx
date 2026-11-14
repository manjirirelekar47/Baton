/**
 * AuditPage.tsx
 * Theme-aware Dispatcher for Baton's Audit Logs & Traceability.
 */

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { AuditPageLight } from "./AuditPageLight";
import { AuditPageDark } from "./AuditPageDark";

export const AuditPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <AuditPageDark />;
  }

  return <AuditPageLight />;
};

export default AuditPage;
