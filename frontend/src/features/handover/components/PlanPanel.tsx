import { EmptyState, StateBadge } from "@/shared/ui";
import type { EvidenceView, PlanBuckets, PlanItem } from "../api";
import { CitationChip } from "./CitationChip";

const BUCKETS: { key: keyof PlanBuckets; title: string; hint: string }[] = [
  { key: "day_1", title: "Day 1", hint: "Nothing blocks these. Start here." },
  { key: "week_1", title: "Week 1", hint: "Each waits on a Day 1 item." },
  { key: "month_1", title: "Month 1", hint: "Each waits on a Week 1 item or later." },
];
const KIND_LABEL: Record<PlanItem["kind"], string> = {
  unblock: "Unblock",
  confirm_owner: "Confirm ownership",
  next_action: "Next action",
};

export function PlanPanel({ plan, onOpenCitation }: { plan: PlanBuckets; onOpenCitation: (e: EvidenceView) => void }) {
  const titles = new Map<string, string>();
  Object.values(plan).forEach((items) => items.forEach((i) => titles.set(i.claim_id, i.title)));
  const total = BUCKETS.reduce((n, b) => n + plan[b.key].length, 0);
  if (total === 0) {
    return <EmptyState title="No plan items yet">The approved handover has no next actions, blockers or owners you can see.</EmptyState>;
  }
  return (
    <div className="space-y-8">
      {BUCKETS.map((bucket) => (
        <section key={bucket.key} aria-labelledby={`plan-${bucket.key}`}>
          <h2 id={`plan-${bucket.key}`} className="text-xl font-bold text-white tracking-tight">{bucket.title}</h2>
          <p className="text-xs text-gray-400">{bucket.hint}</p>
          {plan[bucket.key].length === 0 ? (
            <p className="mt-2 text-xs text-gray-500 italic">Nothing planned here.</p>
          ) : (
            <ol className="mt-3.5 space-y-3">
              {plan[bucket.key].map((item) => (
                <li key={item.claim_id} className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 shadow-xl text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-purple-300 bg-purple-950/40 px-2.5 py-0.5 rounded border border-purple-500/20">
                      {item.position}. {KIND_LABEL[item.kind]}
                    </span>
                    <StateBadge state={item.state} />
                  </div>
                  <p className="mt-2 text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Owner: <span className="text-gray-200">{item.owner_known ? item.owner : "unknown"}</span>
                    {item.proposed_for_me && " • Proposed for you: accept or decline it on the Handover tab"}
                    {item.due_date && ` • Due ${item.due_date}`}
                  </p>
                  {item.blocked_by.length > 0 && (
                    <p className="mt-1 text-xs text-amber-300">
                      Blocked by: {item.blocked_by.map((id) => titles.get(id) ?? id).join("; ")}
                    </p>
                  )}
                  {item.cycle && (
                    <p role="alert" className="mt-2 text-xs text-rose-300 border border-rose-500/30 bg-rose-950/30 p-2 rounded-xl">
                      These items block each other. Decide which goes first.
                    </p>
                  )}
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    {item.evidence.map((e) => <CitationChip key={`${e.chunk_id}:${e.quote}`} evidence={e} onOpen={onOpenCitation} />)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
