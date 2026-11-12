import { Link, useLocation } from "react-router-dom";
import { activeStep, STEPS } from "./steps";

export function ProgressBar() {
  const { pathname, search } = useLocation();
  const current = activeStep(pathname, search);
  return (
    <nav aria-label="Handover progress" className="border-b border-line bg-wash">
      <ol className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-sm">
        {STEPS.map((step) => {
          const state = step.n < current ? "done" : step.n === current ? "current" : "todo";
          return (
            <li key={step.n}>
              <Link
                to={step.to}
                aria-current={state === "current" ? "step" : undefined}
                className={state === "current" ? "font-semibold text-olive underline underline-offset-4" : "text-muted hover:text-ink"}
              >
                Step {step.n}: {step.label}
                {state === "done" && <span className="sr-only"> (passed)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
