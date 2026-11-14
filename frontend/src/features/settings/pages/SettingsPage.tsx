/**
 * SettingsPage.tsx
 * Theme-aware Dispatcher for Baton's Project Settings.
 */

import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { SettingsPageLight } from "./SettingsPageLight";
import { SettingsPageDark } from "./SettingsPageDark";

export const SettingsPage: React.FC = () => {
  const { theme } = useTheme();

  if (theme === "dark") {
    return <SettingsPageDark />;
  }

  return <SettingsPageLight />;
};

export default SettingsPage;
