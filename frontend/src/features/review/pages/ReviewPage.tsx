import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth";
import { Button, EmptyState, ErrorState, Loading } from "@/shared/ui";
import { SourceDrawer } from "@/features/sources/public";
import {
  approveVersion,
  confirmAllVerified,
  getGapInterview,
  getReadiness,
  getReviewQueue,
  postAction,
} from "../api";
import type { ActionRequest, QueueItem } from "../types";
import { AcceptUncertaintyDialog } from "../components/AcceptUncertaintyDialog";
import { ApprovalBar } from "../components/ApprovalBar";
import { AskLeaverDialog } from "../components/AskLeaverDialog";
import { AuditTrailModal } from "../components/AuditTrailModal";
import { ConflictModal } from "../components/ConflictModal";
import { EditDialog } from "../components/EditDialog";
import { GapInterviewView } from "../components/GapInterviewView";
import { QueueItemCard } from "../components/QueueItemCard";
import { VersionHistoryModal } from "../components/VersionHistoryModal";

type FilterTab = "all" | "pending" | "conflicts" | "inferred" | "decided";

export function ReviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Dialog & drawer states
  const [activeConflictClaim, setActiveConflictClaim] = useState<QueueItem | null>(null);
  const [editingClaim, setEditingClaim] = useState<QueueItem | null>(null);
  const [uncertaintyClaim, setUncertaintyClaim] = useState<QueueItem | null>(null);
  const [askingClaim, setAskingClaim] = useState<QueueItem | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showGapInterview, setShowGapInterview] = useState(false);
  const [sourceViewer, setSourceViewer] = useState<{ chunkId: string; quote: string } | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Queries
  const isApprover = user?.role === "approver";

  const queueQuery = useQuery({
    queryKey: ["reviewQueue", user?.id],
    queryFn: getReviewQueue,
    enabled: isApprover,
  });

  const readinessQuery = useQuery({
    queryKey: ["readiness", user?.id],
    queryFn: getReadiness,
    enabled: isApprover,
  });

  const gapQuery = useQuery({
    queryKey: ["gapInterview", user?.id],
    queryFn: getGapInterview,
    enabled: isApprover || user?.role === "leaver",
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: ({ claimId, req }: { claimId: string; req: ActionRequest }) =>
      postAction(claimId, req),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      setActiveConflictClaim(null);
      setEditingClaim(null);
      setUncertaintyClaim(null);
      setAskingClaim(null);
      setStatusMessage({ text: `Action recorded for claim ${data.claim.claim_id}.` });
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message || "Failed to record action.", isError: true });
    },
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: confirmAllVerified,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      setStatusMessage({
        text: `Confirmed ${data.confirmed} verified claim(s) without human intervention.`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message || "Bulk confirm failed.", isError: true });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ sharedRoles, note }: { sharedRoles: string[]; note?: string }) =>
      approveVersion({ shared_to_roles: sharedRoles, note }),
    onSuccess: (ver) => {
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      setShowVersions(true);
      setStatusMessage({
        text: `Version ${ver.version_id} successfully approved with snapshot hash ${ver.snapshot_hash.slice(0, 16)}…`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message || "Approval failed.", isError: true });
    },
  });

  // Role: Leaver sees Gap Interview
  if (user?.role === "leaver") {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-olive">Leaver Handover</h1>
          <p className="mt-1 text-sm text-muted">
            Welcome, Aarav. Complete your knowledge transfer by addressing questions on undocumented logic and approver inquiries.
          </p>
        </div>
        <GapInterviewView />
      </section>
    );
  }

  // Role: Incoming Reader / Contributor
  if (user?.role === "incoming_maintainer" || user?.role === "incoming_contributor") {
    return (
      <section className="space-y-6">
        <h1 className="font-display text-3xl text-olive">Review and approve</h1>
        <div className="rounded-lg border border-line bg-card p-8 text-center max-w-xl mx-auto shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-2xl">
            📋
          </div>
          <h2 className="mt-4 font-display text-xl text-ink">Read-Only View</h2>
          <p className="mt-2 text-sm text-muted">
            The review and approval pipeline is restricted to project approvers. As an incoming team member,
            you can browse approved versions or explore the complete handover documentation.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="quiet" onClick={() => setShowVersions(true)}>
              View Approved Versions
            </Button>
            <Link
              to="/handover"
              className="inline-flex items-center rounded-md bg-olive px-4 py-2 text-sm font-medium text-white hover:bg-[#3d4a20]"
            >
              Go to Handover
            </Link>
          </div>
        </div>

        {showVersions && <VersionHistoryModal onClose={() => setShowVersions(false)} />}
      </section>
    );
  }

  // Role: Approver
  const queue = queueQuery.data;
  const readiness = readinessQuery.data;
  const items = queue?.items ?? [];

  // Filter items
  const filteredItems = items.filter((item) => {
    switch (filter) {
      case "pending":
        return item.pending;
      case "conflicts":
        return (item.conflict_with && item.conflict_with.length > 0) || item.state.toLowerCase() === "conflicting";
      case "inferred":
        return item.state.toLowerCase() === "inferred";
      case "decided":
        return !item.pending;
      case "all":
      default:
        return true;
    }
  });

  const pendingCount = items.filter((i) => i.pending).length;
  const conflictCount = items.filter(
    (i) => (i.conflict_with && i.conflict_with.length > 0) || itemIsConflicting(i)
  ).length;
  const inferredCount = items.filter((i) => i.state.toLowerCase() === "inferred").length;
  const decidedCount = items.filter((i) => !i.pending).length;

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-olive">Review and approve</h1>
          <p className="mt-1 text-sm text-muted">
            Risk-sorted queue of extracted knowledge claims. Address conflicts, review citations, and seal an immutable snapshot.
          </p>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          role="alert"
          className={`rounded-md p-4 text-sm flex items-center justify-between ${
            statusMessage.isError
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Readiness & Approval Bar */}
      <ApprovalBar
        readiness={readiness}
        loading={readinessQuery.isLoading}
        onBulkConfirm={() => bulkConfirmMutation.mutate()}
        bulkConfirmLoading={bulkConfirmMutation.isPending}
        onApprove={(roles) => approveMutation.mutate({ sharedRoles: roles })}
        approveLoading={approveMutation.isPending}
        onOpenVersions={() => setShowVersions(true)}
        onOpenAudit={() => setShowAudit(true)}
        onOpenGapInterview={() => setShowGapInterview(true)}
        unansweredGapsCount={gapQuery.data?.unanswered ?? 0}
      />

      {/* Loading & Error States for Queue */}
      {queueQuery.isLoading && <Loading label="Loading review queue" />}
      {queueQuery.error && (
        <ErrorState
          title="Could not load review queue"
          detail={(queueQuery.error as Error).message}
          onRetry={() => void queueQuery.refetch()}
        />
      )}

      {/* Queue Content */}
      {queue && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-2">Filter:</span>
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All (${items.length})`}
            />
            <FilterButton
              active={filter === "pending"}
              onClick={() => setFilter("pending")}
              label={`Pending (${pendingCount})`}
              highlight={pendingCount > 0}
            />
            <FilterButton
              active={filter === "conflicts"}
              onClick={() => setFilter("conflicts")}
              label={`Conflicts (${conflictCount})`}
              danger={conflictCount > 0}
            />
            <FilterButton
              active={filter === "inferred"}
              onClick={() => setFilter("inferred")}
              label={`Inferred (${inferredCount})`}
              highlight={inferredCount > 0}
            />
            <FilterButton
              active={filter === "decided"}
              onClick={() => setFilter("decided")}
              label={`Decided (${decidedCount})`}
            />
          </div>

          {/* Cards List */}
          {filteredItems.length === 0 ? (
            <EmptyState title="No claims found in this filter">
              Try selecting another tab or confirm verified items to update the queue.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <QueueItemCard
                  key={item.claim_id}
                  item={item}
                  onConfirm={() =>
                    actionMutation.mutate({ claimId: item.claim_id, req: { action: "confirm" } })
                  }
                  onReject={() =>
                    actionMutation.mutate({ claimId: item.claim_id, req: { action: "reject" } })
                  }
                  onMarkUnknown={() =>
                    actionMutation.mutate({ claimId: item.claim_id, req: { action: "mark_unknown" } })
                  }
                  onOpenEdit={() => setEditingClaim(item)}
                  onOpenConflict={() => setActiveConflictClaim(item)}
                  onOpenAcceptUncertainty={() => setUncertaintyClaim(item)}
                  onOpenAskLeaver={() => setAskingClaim(item)}
                  onOpenSource={(chunkId, quote) => setSourceViewer({ chunkId, quote })}
                  actionLoading={actionMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals & Drawers */}
      {activeConflictClaim && (
        <ConflictModal
          claim={activeConflictClaim}
          allClaims={items}
          onResolve={(chosenClaimId, note) =>
            actionMutation.mutate({
              claimId: activeConflictClaim.claim_id,
              req: { action: "resolve_conflict", chosen_claim_id: chosenClaimId, note },
            })
          }
          onAcceptUncertainty={(note) =>
            actionMutation.mutate({
              claimId: activeConflictClaim.claim_id,
              req: { action: "accept_uncertainty", note },
            })
          }
          onClose={() => setActiveConflictClaim(null)}
          onOpenSource={(chunkId, quote) => setSourceViewer({ chunkId, quote })}
          submitting={actionMutation.isPending}
        />
      )}

      {editingClaim && (
        <EditDialog
          claim={editingClaim}
          onSave={(editedStatement, note) =>
            actionMutation.mutate({
              claimId: editingClaim.claim_id,
              req: { action: "edit", edited_statement: editedStatement, note },
            })
          }
          onClose={() => setEditingClaim(null)}
          submitting={actionMutation.isPending}
        />
      )}

      {uncertaintyClaim && (
        <AcceptUncertaintyDialog
          claim={uncertaintyClaim}
          onConfirm={(note) =>
            actionMutation.mutate({
              claimId: uncertaintyClaim.claim_id,
              req: { action: "accept_uncertainty", note },
            })
          }
          onClose={() => setUncertaintyClaim(null)}
          submitting={actionMutation.isPending}
        />
      )}

      {askingClaim && (
        <AskLeaverDialog
          claim={askingClaim}
          onSend={(note) =>
            actionMutation.mutate({
              claimId: askingClaim.claim_id,
              req: { action: "ask_leaver", note },
            })
          }
          onClose={() => setAskingClaim(null)}
          submitting={actionMutation.isPending}
        />
      )}

      {showAudit && <AuditTrailModal onClose={() => setShowAudit(false)} />}

      {showVersions && <VersionHistoryModal onClose={() => setShowVersions(false)} />}

      {showGapInterview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gap Interview Review"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-line bg-card p-6 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <h2 className="font-display text-xl text-olive">Leaver Gap Interview Status</h2>
              <button
                type="button"
                onClick={() => setShowGapInterview(false)}
                className="rounded-md border border-line px-3 py-1 text-sm font-medium hover:bg-wash"
              >
                Close
              </button>
            </div>
            <GapInterviewView />
          </div>
        </div>
      )}

      {sourceViewer && (
        <SourceDrawer
          chunkId={sourceViewer.chunkId}
          quote={sourceViewer.quote}
          onClose={() => setSourceViewer(null)}
        />
      )}
    </section>
  );
}

function itemIsConflicting(item: QueueItem): boolean {
  return (item.conflict_with && item.conflict_with.length > 0) || item.state.toLowerCase() === "conflicting";
}

function FilterButton({
  active,
  onClick,
  label,
  danger,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "bg-olive text-white"
          : danger
          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : highlight
          ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : "border border-line bg-card text-ink hover:bg-wash"
      }`}
    >
      {label}
    </button>
  );
}
