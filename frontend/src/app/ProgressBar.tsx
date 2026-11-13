import { Link, useLocation } from "react-router-dom";
import { activeStep, STEPS } from "./steps";

export function ProgressBar() {
  const { pathname, search } = useLocation();
  const current = activeStep(pathname, search);

  // If on Dashboard, only show if desired or keep compact
  return (
    <nav aria-label="Handover progress" className="bg-white border-b border-slate-200/80 px-6 py-2.5 overflow-x-auto">
      <div className="max-w-7xl mx-auto flex items-center justify-between min-w-[620px] text-xs">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mr-4 shrink-0">
          Handover Flow:
        </span>
        <ol className="flex items-center gap-3 sm:gap-6 flex-1 justify-between">
          {STEPS.map((step) => {
            const isDone = step.n < current;
            const isCurrent = step.n === current;
            const state = isDone ? "done" : isCurrent ? "current" : "todo";

            return (
              <li key={step.n} className="flex items-center gap-2">
                <Link
                  to={step.to}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl font-semibold transition ${
                    isCurrent
                      ? "bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-sm"
                      : isDone
                        ? "text-emerald-700 hover:bg-emerald-50"
                        : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isDone ? "✓" : step.n}
                  </span>
                  <span>
                    Step {step.n}: {step.label}
                  </span>
                  {state === "done" && <span className="sr-only"> (passed)</span>}
                </Link>
                {step.n < STEPS.length && (
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
