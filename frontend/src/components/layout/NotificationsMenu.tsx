import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../app/api";
import { useAuth } from "../../context/AuthContext";
import type { ReviewQueue } from "../../features/review/types";

type Theme = "light" | "dark";

function readNotifications(userId: string): string[] {
  try {
    const stored = localStorage.getItem(`baton.notifications.read.${userId}`);
    const value: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
  } catch {
    return [];
  }
}

export function NotificationsMenu({ theme }: { theme: Theme }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";

  useEffect(() => {
    setReadIds(user ? readNotifications(user.id) : []);
  }, [user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const { data, error, isLoading } = useQuery({
    queryKey: ["notification-review-queue", user?.id],
    queryFn: () => api<ReviewQueue>("/review/queue"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = useMemo(() => (data?.items ?? []).filter((item) => item.pending), [data]);
  const unreadCount = items.reduce((count, item) => count + (readIds.includes(item.claim_id) ? 0 : 1), 0);
  const panelClass = dark
    ? "border-white/15 bg-slate-950/95 text-white"
    : "border-slate-200 bg-white/95 text-slate-900";
  const mutedClass = dark ? "text-slate-400" : "text-slate-500";

  function markRead(claimIds: string[]) {
    if (!user) return;
    const next = Array.from(new Set([...readIds, ...claimIds]));
    setReadIds(next);
    try {
      localStorage.setItem(`baton.notifications.read.${user.id}`, JSON.stringify(next));
    } catch {
      // Keep read state for this page session if browser storage is unavailable.
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors shadow-xs relative ${
          dark
            ? "bg-white/10 hover:bg-white/20 border-white/15 text-gray-300 hover:text-white"
            : "bg-white hover:bg-slate-100 border-slate-200/80 text-slate-500 hover:text-slate-800"
        }`}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Notifications"
          className={`absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border p-3 z-50 text-xs backdrop-blur-2xl ${panelClass}`}
        >
          <header className={`flex items-center justify-between pb-2 border-b ${dark ? "border-white/10" : "border-slate-100"}`}>
            <div>
              <h2 className="font-bold">Notifications</h2>
              <p className={`mt-0.5 ${mutedClass}`}>{unreadCount} unread · {items.length} pending review</p>
            </div>
            <button
              type="button"
              onClick={() => markRead(items.map((item) => item.claim_id))}
              disabled={unreadCount === 0}
              className={`inline-flex items-center gap-1 font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${dark ? "text-purple-300" : "text-purple-700"}`}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </header>

          <div className="max-h-80 overflow-y-auto py-2 space-y-2">
            {isLoading && <p role="status" className={`p-2 ${mutedClass}`}>Loading notifications…</p>}
            {error && <p role="alert" className="p-2 text-rose-500">Could not load notifications: {(error as Error).message}</p>}
            {!isLoading && !error && items.length === 0 && (
              <p className={`p-3 text-center ${mutedClass}`}>You’re all caught up. No pending reviews.</p>
            )}
            {items.map((item) => {
              const isUnread = !readIds.includes(item.claim_id);
              return (
                <button
                  key={item.claim_id}
                  type="button"
                  onClick={() => {
                    markRead([item.claim_id]);
                    setIsOpen(false);
                    navigate("/review");
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                    isUnread
                      ? dark
                        ? "bg-purple-950/40 border-purple-500/20 hover:bg-purple-900/50"
                        : "bg-purple-50 border-purple-100 hover:bg-purple-100"
                      : dark
                        ? "bg-white/[0.03] border-white/10 hover:bg-white/[0.07]"
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <span className={`mt-0.5 ${isUnread ? "text-purple-500" : mutedClass}`}>
                      {isUnread ? <Bell className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-4">Review required: {item.entity_key || item.claim_type}</span>
                      <span className={`mt-1 block line-clamp-2 ${mutedClass}`}>{item.statement}</span>
                      <span className={`mt-1 block ${mutedClass}`}>Open review queue</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
