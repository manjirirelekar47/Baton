import React from "react";

const LOGO_ASSET_PATH = "/assets/baton-logo.png";

export const FallbackHero: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = "",
  isDark = false,
}) => (
  <div
    className={`relative w-full h-[280px] sm:h-[320px] lg:h-[360px] flex items-center justify-center overflow-hidden select-none ${className}`}
  >
    <div className="absolute inset-0 pointer-events-none opacity-80">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200/40 dark:bg-purple-600/25 rounded-full blur-3xl transition-colors duration-500" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-200/40 dark:bg-indigo-600/25 rounded-full blur-2xl transition-colors duration-500" />
    </div>

    <div className="absolute w-72 h-72 rounded-full border border-indigo-400/40 rotate-[55deg] scale-y-[0.38] pointer-events-none animate-spin-slow" />
    <div className="absolute w-88 h-88 rounded-full border border-purple-400/35 rotate-[-35deg] scale-y-[0.38] pointer-events-none" />

    <div className="relative w-48 h-48 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-white/70 via-purple-100/40 to-indigo-100/60 dark:from-slate-900/80 dark:via-purple-950/40 dark:to-indigo-950/60 backdrop-blur-2xl border border-white/80 dark:border-white/20 shadow-[0_20px_50px_rgba(79,70,229,0.25)] flex items-center justify-center p-4">
      <div className="absolute top-2 left-6 w-14 h-7 rounded-full bg-white/60 dark:bg-white/30 blur-[2px] rotate-[-25deg] pointer-events-none" />
      <img
        src={LOGO_ASSET_PATH}
        alt="Baton"
        className={`w-32 h-32 sm:w-36 sm:h-36 object-contain drop-shadow-md transition-all duration-300 ${
          isDark ? "drop-shadow-[0_0_16px_rgba(168,85,247,0.6)]" : ""
        }`}
        onError={(event) => {
          event.currentTarget.src = "/logo.png";
        }}
      />
    </div>
  </div>
);
