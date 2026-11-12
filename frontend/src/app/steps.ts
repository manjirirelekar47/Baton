/** Five-step progress bar (Connect, Reconstruct, Verify, Review, Handover). FROZEN after Day 0. */
export const STEPS = [
  { n: 1, label: "Connect", to: "/sources" },
  { n: 2, label: "Reconstruct", to: "/ledger" },
  { n: 3, label: "Verify", to: "/ledger?view=verify" },
  { n: 4, label: "Review", to: "/review" },
  { n: 5, label: "Handover", to: "/handover" },
] as const;

export function activeStep(pathname: string, search: string): number {
  if (pathname.startsWith("/sources")) return 1;
  if (pathname.startsWith("/ledger")) return new URLSearchParams(search).get("view") === "verify" ? 3 : 2;
  if (pathname.startsWith("/risk")) return 2;
  if (pathname.startsWith("/review")) return 4;
  if (pathname.startsWith("/handover")) return 5;
  return 0;
}
