import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  UserPlus,
  Mail,
  Copy,
  Check,
  Shield,
  UserCheck,
  Users,
  Compass,
  Clock,
  Ban,
  Share2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { batonApi, type InvitationItem, type Role } from "../../api/client";
import { ROLE_LABELS } from "../../shared/types";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
  currentUserRole?: Role | string;
}

const ROLES: { role: Role; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    role: "approver",
    label: "Approver (Engineering Lead)",
    desc: "Full administrative oversight, manage project sources, issue invitations",
    icon: Shield,
  },
  {
    role: "leaver",
    label: "Leaver",
    desc: "Departing lead handing over institutional knowledge and context",
    icon: Compass,
  },
  {
    role: "incoming_maintainer",
    label: "Incoming Maintainer",
    desc: "Architectural ownership, system maintenance, and roadmap continuity",
    icon: UserCheck,
  },
  {
    role: "incoming_contributor",
    label: "Incoming Contributor",
    desc: "General team member contributing code, verified claims, and tasks",
    icon: Users,
  },
];

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = "Active Project",
  currentUserRole = "approver",
}) => {
  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [selectedRole, setSelectedRole] = useState<Role>("incoming_contributor");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInvitation, setSuccessInvitation] = useState<InvitationItem | null>(null);

  // Manage Tab State
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "redeemed" | "revoked">("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Load invitations
  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const data = await batonApi.getInvitations(projectId);
      setInvitations(data);
    } catch {
      // Handled gracefully in UI
    } finally {
      setLoadingInvitations(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      void loadInvitations();
    } else {
      // Reset form state on close
      setError(null);
      setSuccessInvitation(null);
      setEmail("");
      setSelectedRole("incoming_contributor");
      setCopiedCode(false);
      setCopiedMessage(false);
    }
  }, [isOpen, loadInvitations]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cleanEmail = email.trim() || undefined;
      const inv = await batonApi.createInvitation(selectedRole, cleanEmail, projectId);
      setSuccessInvitation(inv);
      await loadInvitations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invitation code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (invId: string) => {
    if (!window.confirm("Are you sure you want to revoke this invitation? This code will no longer be redeemable.")) {
      return;
    }
    setRevokingId(invId);
    try {
      await batonApi.revokeInvitation(invId);
      await loadInvitations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation.");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string, isMsg = false) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isMsg) {
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    }
  };

  const getInviteShareMessage = (inv: InvitationItem) => {
    const roleLabel = ROLE_LABELS[inv.role] || inv.role;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://baton.internal";
    return `You've been invited to join "${projectName}" on Baton as ${roleLabel}.\nInvitation Code: ${inv.code}\nJoin here: ${origin}/signup`;
  };

  const filteredInvitations = useMemo(() => {
    if (filterStatus === "all") return invitations;
    return invitations.filter((inv) => {
      const normalizedStatus = inv.status === "used" ? "redeemed" : inv.status;
      return normalizedStatus === filterStatus;
    });
  }, [invitations, filterStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: invitations.length,
      active: invitations.filter((i) => i.status === "active").length,
      redeemed: invitations.filter((i) => i.status === "redeemed" || i.status === "used").length,
      revoked: invitations.filter((i) => i.status === "revoked").length,
    };
  }, [invitations]);

  if (!isOpen || currentUserRole !== "approver") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
                Project Invitations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate single-use invitation codes bound to <span className="font-semibold text-purple-600 dark:text-purple-300">{projectName}</span>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-white/10 px-6 pt-3 gap-2 flex-shrink-0 bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "create"
                ? "border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-300"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Member</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("manage");
              void loadInvitations();
            }}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "manage"
                ? "border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-300"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Manage Invitations</span>
            {invitations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                {invitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "create" ? (
            successInvitation ? (
              /* Success Card with Generated Code and Share Options */
              <div className="space-y-5 animate-in fade-in">
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-sm">Invitation Code Generated Successfully</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    This single-use code is bound to <strong className="font-semibold">{projectName}</strong> with role{" "}
                    <strong className="font-semibold">{ROLE_LABELS[successInvitation.role] || successInvitation.role}</strong>
                    {successInvitation.email && (
                      <>
                        {" "}and restricted to <strong className="font-semibold">{successInvitation.email}</strong>
                      </>
                    )}.
                  </p>

                  {/* Code Display */}
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-black/60 border border-emerald-300 dark:border-emerald-500/40 shadow-inner">
                    <code className="text-base sm:text-lg font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-wider select-all break-all">
                      {successInvitation.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successInvitation.code, false)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors flex-shrink-0 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                </div>

                {/* Share Message Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium flex items-center gap-1">
                      <Share2 className="w-3.5 h-3.5 text-purple-500" />
                      <span>Ready-to-share message</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getInviteShareMessage(successInvitation), true)}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedMessage ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMessage ? "Copied Message!" : "Copy Message"}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                    {getInviteShareMessage(successInvitation)}
                  </pre>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessInvitation(null);
                      setEmail("");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30 transition-colors cursor-pointer"
                  >
                    + Create Another Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("manage");
                      void loadInvitations();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>View All Invitations</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleCreate} className="space-y-5">
                {/* Role Selection */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    1. Select Role for New Member
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      const isSelected = selectedRole === r.role;
                      return (
                        <button
                          key={r.role}
                          type="button"
                          onClick={() => setSelectedRole(r.role)}
                          className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? "bg-purple-50/80 dark:bg-purple-950/50 border-purple-500 dark:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500 dark:ring-purple-400"
                              : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${isSelected ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
                              <span className={`text-xs font-bold ${isSelected ? "text-purple-900 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
                                {r.label}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {r.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Email Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="invite-email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      2. Invitee Email <span className="font-normal normal-case text-slate-400 dark:text-slate-500">(Optional)</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. colleague@company.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:focus:ring-purple-400/40 transition-all shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If specified, only this email address will be authorized to redeem the generated invitation code.
                  </p>
                </div>

                {/* Submit CTA */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-purple-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Generate Single-Use Code</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Manage Invitations Tab */
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
                  {(["all", "active", "redeemed", "revoked"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all capitalize cursor-pointer flex items-center gap-1.5 ${
                        filterStatus === st
                          ? "bg-white dark:bg-purple-900/60 text-purple-700 dark:text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <span>{st}</span>
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-slate-200 dark:bg-black/40 text-slate-700 dark:text-slate-300">
                        {statusCounts[st]}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void loadInvitations()}
                  disabled={loadingInvitations}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Refresh list"
                  aria-label="Refresh invitations list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInvitations ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* List */}
              {loadingInvitations && invitations.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
                  <span className="text-xs">Loading invitations...</span>
                </div>
              ) : filteredInvitations.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-6 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    No {filterStatus !== "all" ? filterStatus : ""} invitations found for this project.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    + Generate an invitation code
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredInvitations.map((inv) => {
                    const normStatus = inv.status === "used" ? "redeemed" : inv.status;
                    const isActive = normStatus === "active";
                    const isRedeemed = normStatus === "redeemed";
                    const isRevoked = normStatus === "revoked";

                    return (
                      <div
                        key={inv.id}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wide">
                              {inv.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(inv.code)}
                              className="p-1 rounded text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                              title="Copy code"
                              aria-label="Copy code"
                            >
                              <Copy className="w-3 h-3" />
                            </button>

                            {/* Role Badge */}
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                              {ROLE_LABELS[inv.role] || inv.role}
                            </span>

                            {/* Status Badge */}
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            )}
                            {isRedeemed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40">
                                <Check className="w-2.5 h-2.5 text-blue-600" />
                                Redeemed
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                                <Ban className="w-2.5 h-2.5" />
                                Revoked
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>
                              {inv.email ? (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{inv.email}</span>
                                </span>
                              ) : (
                                "Open to any email"
                              )}
                            </span>
                            <span>•</span>
                            <span>Created {new Date(inv.created_at).toLocaleDateString()}</span>
                            {isRedeemed && (
                              <>
                                <span>•</span>
                                <span className="text-purple-600 dark:text-purple-300 font-medium">
                                  Redeemed by {inv.used_by_name || "member"}
                                  {inv.used_at ? ` on ${new Date(inv.used_at).toLocaleDateString()}` : ""}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(inv.id)}
                              disabled={revokingId === inv.id}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {revokingId === inv.id ? "Revoking..." : "Revoke"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
