import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { ProfileMenuContent } from "./ProfileMenuContent";

export interface TopHeaderUserMenuProps {
  theme: "dark" | "light";
  userInitials: string;
  onOpenResetModal: () => void;
}

export const TopHeaderUserMenu: React.FC<TopHeaderUserMenuProps> = ({
  theme,
  userInitials,
  onOpenResetModal,
}) => {
  const { user, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (loading || !user) {
    return (
      <div
        className={`w-9 h-9 rounded-xl animate-pulse flex-shrink-0 ${
          theme === "dark" ? "bg-slate-800" : "bg-slate-200"
        }`}
      />
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white font-bold text-xs flex items-center justify-center shadow-sm shadow-purple-500/20 flex-shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        aria-label={user ? `User profile menu for ${user.name}` : "User profile menu"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {userInitials || "U"}
      </button>

      {isOpen && (
        <ProfileMenuContent
          theme={theme}
          onClose={() => setIsOpen(false)}
          onOpenResetModal={onOpenResetModal}
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)]"
        />
      )}
    </div>
  );
};
