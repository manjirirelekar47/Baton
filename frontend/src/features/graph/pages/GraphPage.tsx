/**
 * GraphPage.tsx
 * Theme-aware Dispatcher for Baton's Knowledge Graph.
 */

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { GraphPageLight } from "./GraphPageLight";
import { GraphPageDark } from "./GraphPageDark";

export const GraphPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <GraphPageDark />;
  }

  return <GraphPageLight />;
};

export default GraphPage;
