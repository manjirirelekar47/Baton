/**
 * RiskPage.tsx
 * Orchestrator and Dispatcher for Baton's Risk Radar & Timeline.
 * Dynamically switches between RiskPageLight and RiskPageDark depending on active theme,
 * guaranteeing 100% clean isolation with zero styling pollution.
 */

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { RiskPageLight } from "./RiskPageLight";
import { RiskPageDark } from "./RiskPageDark";

export const RiskPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <RiskPageDark />;
  }

  return <RiskPageLight />;
};

export default RiskPage;
