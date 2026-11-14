/**
 * PlaceholderPage.tsx
 * Theme-aware Dispatcher for Baton's platform routes (/graph, /access, /audit, /settings).
 * Dynamically switches between PlaceholderPageLight and PlaceholderPageDark,
 * ensuring 100% style isolation and preserving Light Mode completely untouched.
 */

import React from "react";
import { useTheme } from "../context/ThemeContext";
import { PlaceholderPageLight } from "./PlaceholderPageLight";
import { PlaceholderPageDark } from "./PlaceholderPageDark";

export const PlaceholderPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <PlaceholderPageDark />;
  }

  return <PlaceholderPageLight />;
};

export default PlaceholderPage;
