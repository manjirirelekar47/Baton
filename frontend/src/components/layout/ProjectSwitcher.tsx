import React, { useState, useRef, useEffect } from "react";
import { FolderGit2, ChevronDown, Check, Plus, KeyRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PROJECT_ROLE_TITLES: Record<string, string> = {
  approver: "Engineering Lead",
  leaver: "Departing Lead",
  incoming_maintainer: "Incoming Maintainer",
  incoming_contributor: "Incoming Contributor",
};

export function ProjectSwitcher() {
  const {
    user,
    projects,
    activeProject,
    switchProject,
    createProject,
    joinProject,
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const currentProjectName = activeProject?.name || "Campus Event Portal";
  const currentRole = user?.role ? PROJECT_ROLE_TITLES[user.role] || user.role : "Member";

  const handleSwitch = async (projectId: string) => {
    if (activeProject && activeProject.id === projectId) {
      setIsOpen(false);
      return;
    }
    try {
      await switchProject(projectId);
      setIsOpen(false);
    } catch {
      // Error is stored in auth context
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setModalError("Please enter a project name.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await createProject(projectName.trim());
      setProjectName("");
      setShowCreateModal(false);
      setIsOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setModalError("Please enter an invitation code.");
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await joinProject(inviteCode.trim());
      setInviteCode("");
      setShowJoinModal(false);
      setIsOpen(false);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to join project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left focus:outline-none cursor-pointer
          bg-slate-100/80 hover:bg-slate-200/80 border-slate-200 text-slate-800
          dark:bg-white/10 dark:hover:bg-white/15 dark:border-white/15 dark:text-white"
        title="Switch Project"
        aria-expanded={isOpen}
      >
        <FolderGit2 className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
        <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[200px]">
          <span className="text-xs font-bold truncate leading-tight">
            {currentProjectName}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            {currentRole}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 rounded-2xl shadow-2xl border p-2 z-50
            bg-white border-slate-200 text-slate-900
            dark:bg-[#0e1224] dark:border-white/15 dark:text-white backdrop-blur-xl animate-in fade-in zoom-in-95"
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Your Projects
            </span>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              {projects.length || 1} available
            </span>
          </div>

          {/* Project List */}
          <div className="py-1 max-h-56 overflow-y-auto space-y-1">
            {projects.length > 0 ? (
              projects.map((p) => {
                const isSelected = activeProject?.id === p.id || (!activeProject && p.id === "proj-campus-event-portal");
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSwitch(p.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 capitalize">
                        {p.role ? PROJECT_ROLE_TITLES[p.role] || p.role : "Member"}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{currentProjectName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 capitalize">{currentRole}</p>
                </div>
                <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 ml-2" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 mt-1 border-t border-slate-100 dark:border-white/10 space-y-1">
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setShowCreateModal(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer
                text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-white/5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Project</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setShowJoinModal(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer
                text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Join with Invitation Code</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create New Project */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 border bg-white border-slate-200 text-slate-900 dark:bg-[#0d1024] dark:border-white/10 dark:text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Create New Project</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You will automatically become the Engineering Lead (Approver) of this project.
            </p>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Distributed Ledger Service"
                  autoFocus
                  className="w-full py-2.5 px-3 rounded-xl text-sm font-medium focus:outline-none border border-slate-200 dark:border-white/10 dark:bg-white/5 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Project */}
      {showJoinModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 border bg-white border-slate-200 text-slate-900 dark:bg-[#0d1024] dark:border-white/10 dark:text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Join Existing Project</h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the single-use invitation code provided by your project administrator.
            </p>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Invitation Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. INV-LEAVER-7A9B1C2D"
                  autoFocus
                  className="w-full py-2.5 px-3 rounded-xl text-sm font-medium focus:outline-none border border-slate-200 dark:border-white/10 dark:bg-white/5 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 disabled:opacity-50"
                >
                  {submitting ? "Joining…" : "Join Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
