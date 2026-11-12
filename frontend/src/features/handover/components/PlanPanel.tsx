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
          <h2 id={`plan-${bucket.key}`} className="font-display text-2xl text-olive">{bucket.title}</h2>
          <p className="text-sm text-muted">{bucket.hint}</p>
          {plan[bucket.key].length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing planned here.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {plan[bucket.key].map((item) => (
                <li key={item.claim_id} className="rounded-lg border border-line bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{item.position}. {KIND_LABEL[item.kind]}</span>
                    <StateBadge state={item.state} />
                  </div>
                  <p className="mt-1">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    Owner: {item.owner_known ? item.owner : "unknown"}
                    {item.proposed_for_me && ". Proposed for you: accept or decline it on the Handover tab"}
                    {item.due_date && `. Due ${item.due_date}`}
                  </p>
                  {item.blocked_by.length > 0 && (
                    <p className="mt-1 text-sm">Blocked by: {item.blocked_by.map((id) => titles.get(id) ?? id).join("; ")}</p>
                  )}
                  {item.cycle && (
                    <p role="alert" className="mt-1 text-sm text-[var(--conflicting)]">
                      These items block each other. Decide which goes first.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
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
