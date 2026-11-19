import React, { useEffect, useRef } from "react";
import { useAuth, formatUserDropdownRole } from "../../context/AuthContext";
import { isSupabaseConfigured } from "../../features/auth/supabase";
import { linkGithubIdentity } from "../../features/auth/linkGithubIdentity";

export interface ProfileMenuContentProps {
  theme: "dark" | "light";
  onClose: () => void;
  onOpenResetModal: () => void;
  className?: string;
}

const DEMO_ROLES = [
  { role: "approver", name: "Approver (Engineering Lead)" },
  { role: "leaver", name: "Aarav (Departing Lead)" },
  { role: "incoming_maintainer", name: "Meera (Incoming Maintainer)" },
  { role: "contributor", name: "Contributor" },
] as const;

export const ProfileMenuContent: React.FC<ProfileMenuContentProps> = ({
  theme,
  onClose,
  onOpenResetModal,
  className = "",
}) => {
  const { user, switchRole, logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const dividerClass = dark ? "border-white/10" : "border-slate-100";
  const bgClass = dark
    ? "bg-black/95 backdrop-blur-2xl border-white/15 text-white"
    : "bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-800";

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="User profile menu"
      className={`rounded-2xl shadow-2xl border p-2 z-50 text-xs animate-in fade-in duration-150 ${bgClass} ${className}`}
    >
      {user?.is_demo ? (
        <>
          <div className={`px-3 py-2 border-b ${dividerClass} flex items-center justify-between`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-purple-400" : "text-purple-700"}`}>
                Switch Active Role
              </p>
              <p className={`${dark ? "text-gray-400" : "text-slate-500"} text-[11px] truncate`}>Demo Account</p>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${dark ? "bg-purple-950/60 text-purple-300 border border-purple-500/30" : "bg-purple-100 text-purple-700"}`}>
              Demo
            </span>
          </div>

          <div className="py-1 space-y-0.5" role="group" aria-label="Demo Role Selection">
            {DEMO_ROLES.map(({ role, name }) => (
              <button
                key={role}
                type="button"
                role="menuitem"
                onClick={async () => {
                  await switchRole(role);
                  onClose();
                }}
                className={`w-full text-left px-3 py-1.5 rounded-xl font-medium flex items-center justify-between transition-colors ${
                  user?.role === role
                    ? dark
                      ? "bg-purple-950/60 text-purple-300 font-semibold"
                      : "bg-purple-100 text-purple-800 font-semibold"
                    : dark
                    ? "text-gray-300 hover:bg-white/10"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{name}</span>
                {user?.role === role && (
                  <span className={`${dark ? "text-purple-400" : "text-purple-600"} font-bold`}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className={`px-3 py-2.5 border-b ${dividerClass}`}>
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-gray-400" : "text-slate-400"}`}>
              Assigned Role
            </p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${dark ? "bg-purple-950/60 text-purple-300 border border-purple-500/30" : "bg-purple-100 text-purple-700"}`}>
              Verified
            </span>
          </div>
          <p className={`text-sm font-bold ${dark ? "text-white" : "text-slate-800"} mt-0.5`}>
            {formatUserDropdownRole(user)}
          </p>
          <p className={`${dark ? "text-gray-400" : "text-slate-500"} text-[11px] truncate mt-0.5`}>
            {user?.email}
          </p>
        </div>
      )}

      {isSupabaseConfigured && (
        <button
          type="button"
          role="menuitem"
          onClick={async () => {
            try {
              await linkGithubIdentity();
              onClose();
            } catch (linkError) {
              window.alert(linkError instanceof Error ? linkError.message : "Could not link your GitHub account.");
            }
          }}
          className={`w-full text-left px-3 py-1.5 rounded-xl transition-colors ${
            dark ? "text-gray-300 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Link GitHub account
        </button>
      )}

      <div className={`pt-1.5 mt-1 border-t ${dividerClass} flex items-center justify-between px-1`}>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenResetModal();
          }}
          className={`font-medium px-2 py-1 rounded active:scale-[0.98] transition-all duration-150 cursor-pointer ${
            dark
              ? "text-gray-400 hover:text-purple-300 hover:bg-white/5"
              : "text-slate-500 hover:text-purple-700 hover:bg-purple-50"
          }`}
        >
          Reset Demo
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={async () => {
            await logout();
            onClose();
          }}
          className={`font-medium px-2 py-1 rounded transition-colors ${
            dark
              ? "text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
              : "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          }`}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
