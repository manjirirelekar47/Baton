import React from "react";
import { useRouteError, useNavigate } from "react-router-dom";

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {error?.message || error?.statusText || "An unexpected error occurred while loading this view."}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer transition-colors"
          >
            Reload Page
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorBoundary;