import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = "Page Not Found | Baton";
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-black/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-xl shadow-black/40 rounded-3xl p-8 text-center space-y-5 animate-in fade-in duration-300">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center font-bold text-2xl shadow-sm">
          <Compass className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
            404 Error
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Page Not Found
          </h1>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          The page or link you are looking for does not exist, has been moved, or is no longer available.
        </p>

        <div className="pt-2 flex items-center justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2.5 leading-none px-5 py-2.5 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
