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
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: ({ claimId, req }: { claimId: string; req: ActionRequest }) =>
      postAction(claimId, req),
    onSuccess: (updatedClaim) => {
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setStatusMessage({
        text: `Claim ${updatedClaim.claim.claim_id} action saved. New state: ${updatedClaim.claim.state}.`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message || "Failed to perform review action.", isError: true });
    },
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: confirmAllVerified,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["reviewQueue"] });
      queryClient.invalidateQueries({ queryKey: ["readiness"] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setStatusMessage({
        text: `Bulk confirm completed. ${res.confirmed} verified claims confirmed into fact ledger.`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message || "Bulk confirm failed.", isError: true });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ sharedRoles }: { sharedRoles: string[] }) => approveVersion({ shared_to_roles: sharedRoles }),
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
      <section className="space-y-6 max-w-7xl mx-auto w-full pb-12">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Handover Questions & Answers</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
            Welcome, Aarav. Help your team take over smoothly by answering open questions and clarifying project details.
          </p>
        </div>
        <GapInterviewView />
      </section>
    );
  }

  // Role: Incoming Reader / Contributor
  if (user?.role === "incoming_maintainer" || user?.role === "incoming_contributor") {
    return (
      <section className="space-y-6 max-w-7xl mx-auto w-full pb-12">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Handover Checklist & Review</h1>
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 backdrop-blur-2xl p-8 text-center max-w-xl mx-auto shadow-sm dark:shadow-2xl text-slate-900 dark:text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-2xl shadow-xs">
            📋
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white tracking-tight">Read-Only View</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
            The handover checklist is reserved for project approvers. As a team member, you can explore approved records and project documentation.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="quiet" onClick={() => setShowVersions(true)}>
              View Finalized Records
            </Button>
            <Link
              to="/handover"
              className="inline-flex items-center rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition-all"
            >
              Go to Handover Document
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
    <section className="space-y-6 max-w-7xl mx-auto w-full pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Handover Checklist & Review</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
            Review project facts sorted by priority. Fix disagreements, review citations, and finalize a secure handover record.
          </p>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMessage && (
        <div
          role="alert"
          className={`rounded-2xl p-4 text-sm flex items-center justify-between shadow-sm ${
            statusMessage.isError
              ? "border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
              : "border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-80"
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
      {queueQuery.isLoading && <Loading label="Loading handover checklist..." />}
      {queueQuery.error && (
        <ErrorState
          title="Could not load handover checklist"
          detail={(queueQuery.error as Error).message}
          onRetry={() => void queueQuery.refetch()}
        />
      )}

      {/* Queue Content */}
      {queue && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400 mr-2">Filter:</span>
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All (${items.length})`}
            />
            <FilterButton
              active={filter === "pending"}
              onClick={() => setFilter("pending")}
              label={`Needs Review (${pendingCount})`}
              highlight={pendingCount > 0}
            />
            <FilterButton
              active={filter === "conflicts"}
              onClick={() => setFilter("conflicts")}
              label={`Disagreements (${conflictCount})`}
              danger={conflictCount > 0}
            />
            <FilterButton
              active={filter === "inferred"}
              onClick={() => setFilter("inferred")}
              label={`Suggested (${inferredCount})`}
              highlight={inferredCount > 0}
            />
            <FilterButton
              active={filter === "decided"}
              onClick={() => setFilter("decided")}
              label={`Completed (${decidedCount})`}
            />
          </div>

          {/* Cards List */}
          {filteredItems.length === 0 ? (
            <EmptyState title="All clear! No items need attention here.">
              Everything in this category is resolved. Check the other tabs to finalize the handover.
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 p-6 shadow-2xl overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10 mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Open Questions & Handover Answers</h2>
              <button
                type="button"
                onClick={() => setShowGapInterview(false)}
                className="rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-colors"
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
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
        active
          ? "bg-purple-600 text-white shadow-sm dark:shadow-[0_0_15px_rgba(168,85,247,0.35)]"
          : danger
          ? "border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50"
          : highlight
          ? "border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          : "border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
