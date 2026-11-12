/** PUBLIC surface of the review feature. Other features import only from here. STUB (Samruddhi keeps the same exports). */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/api";
import { useAuth } from "@/app/auth";

export interface VersionSummary {
  version_id: string;
  project_id: string;
  status: "draft" | "approved";
  approved_by: string | null;
  approved_at: string | null;
  snapshot_hash: string | null;
  shared_with: string[];
}

/** Latest approved version the signed-in role may open. The backend already filters /versions by role. */
export function useLatestVersion() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["versions", user?.id],
    queryFn: () => api<VersionSummary[]>("/versions"),
    enabled: !!user,
  });
  const approved = (query.data ?? [])
    .filter((v) => v.status === "approved")
    .sort((a, b) => (a.approved_at ?? "").localeCompare(b.approved_at ?? ""));
  return {
    version: approved.length ? approved[approved.length - 1] : null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
