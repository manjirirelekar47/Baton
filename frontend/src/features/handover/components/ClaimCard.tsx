import { StateBadge, Button } from "@/shared/ui";
import type { ClaimView, EvidenceView } from "../api";
import { CitationChip } from "./CitationChip";

interface Props {
  claim: ClaimView;
  canRespond: boolean;
  response?: "accept" | "decline";
  busy?: boolean;
  onRespond: (response: "accept" | "decline") => void;
  onOpenCitation: (evidence: EvidenceView) => void;
}

export function ClaimCard({ claim, canRespond, response, busy, onRespond, onOpenCitation }: Props) {
  const isOwner = claim.type === "owner";
  return (
    <article className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 shadow-xl text-white">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={claim.state} />
        <span className="text-xs text-purple-300 font-mono bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
          Access {claim.access_label}
        </span>
      </div>
      <p className="mt-3 text-base font-semibold leading-relaxed text-white">{claim.statement}</p>

      {isOwner && (
        <dl className="mt-2 text-xs text-gray-300 space-y-1">
          <div><dt className="inline text-gray-400">Recorded owner: </dt><dd className="inline text-white font-medium">{claim.owner ?? "Unknown"}</dd></div>
          {claim.proposed_owner && (
            <div><dt className="inline text-gray-400">Proposed owner: </dt><dd className="inline text-purple-200 font-medium">{claim.proposed_for_me ? "You" : claim.proposed_owner}</dd></div>
          )}
        </dl>
      )}
      {claim.due_date && <p className="mt-1 text-xs text-gray-400">Due <span className="text-white">{claim.due_date}</span> (from the source)</p>}
      {claim.state === "attested" && (
        <p className="mt-1 text-xs text-purple-200/80 italic">Said by {claim.attested_by ?? "a named person"}. Not corroborated by a source document.</p>
      )}

      {isOwner && claim.proposed_for_me && canRespond && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5" role="group" aria-label="Respond to the proposed ownership">
          <Button aria-pressed={response === "accept"} disabled={busy} variant={response === "accept" ? "primary" : "quiet"} onClick={() => onRespond("accept")}>
            Accept ownership
          </Button>
          <Button aria-pressed={response === "decline"} disabled={busy} variant={response === "decline" ? "primary" : "quiet"} onClick={() => onRespond("decline")}>
            Decline ownership
          </Button>
          {response && <span role="status" className="text-xs text-gray-300">You {response === "accept" ? "accepted" : "declined"} this.</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {claim.evidence.length === 0 ? (
          <span className="text-xs text-gray-500 italic">No source quote. This stays a question until someone answers it.</span>
        ) : (
          claim.evidence.map((e) => <CitationChip key={`${e.chunk_id}:${e.quote}`} evidence={e} onOpen={onOpenCitation} />)
        )}
      </div>
    </article>
  );
}
