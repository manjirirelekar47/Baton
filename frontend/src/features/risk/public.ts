/** PUBLIC surface of the risk feature. Other features import from here. */
export type RiskSignal = {
  module: string;
  person: string;
  exclusivity: number;
  dependents: number;
  undocumented_decisions: number;
  account_ties: number;
  work_in_flight: number;
  flagged: boolean;
  reasons: string[];
  evidence_chunk_ids: string[];
};

export { RiskPage } from "./pages/RiskPage";
export { RiskPageLight } from "./pages/RiskPageLight";
export { RiskPageDark } from "./pages/RiskPageDark";
export { RiskCard } from "./components/RiskCard";
export { DeliveryCard } from "./components/DeliveryCard";
