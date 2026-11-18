import React from "react";
import { useRouteError, useNavigate } from "react-router-dom";

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-black/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl shadow-black/40 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Application Error</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {error?.message || error?.statusText || "An unexpected error occurred while loading this view."}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            Reload Page
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-transparent hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorBoundary;