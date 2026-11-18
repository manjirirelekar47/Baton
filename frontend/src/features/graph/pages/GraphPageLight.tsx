/**
 * GraphPageLight.tsx
 * Light Mode entry for Knowledge Graph.
 * Delegates to the unified GraphPage which adapts themes dynamically.
 */

import React from "react";
import { GraphPage } from "./GraphPage";

export const GraphPageLight: React.FC = () => {
  return <GraphPage />;
};

export default GraphPageLight;
