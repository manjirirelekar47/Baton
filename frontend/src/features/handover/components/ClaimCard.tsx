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
    <article className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={claim.state} />
        <span className="text-xs text-muted">Access {claim.access_label}</span>
      </div>
      <p className="mt-2 text-base">{claim.statement}</p>

      {isOwner && (
        <dl className="mt-2 text-sm text-muted">
          <div><dt className="inline">Recorded owner: </dt><dd className="inline text-ink">{claim.owner ?? "Unknown"}</dd></div>
          {claim.proposed_owner && (
            <div><dt className="inline">Proposed owner: </dt><dd className="inline text-ink">{claim.proposed_for_me ? "You" : claim.proposed_owner}</dd></div>
          )}
        </dl>
      )}
      {claim.due_date && <p className="mt-1 text-sm text-muted">Due {claim.due_date} (from the source)</p>}
      {claim.state === "attested" && (
        <p className="mt-1 text-sm text-muted">Said by {claim.attested_by ?? "a named person"}. Not corroborated by a source document.</p>
      )}

      {isOwner && claim.proposed_for_me && canRespond && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Respond to the proposed ownership">
          <Button aria-pressed={response === "accept"} disabled={busy} variant={response === "accept" ? "primary" : "quiet"} onClick={() => onRespond("accept")}>
            Accept ownership
          </Button>
          <Button aria-pressed={response === "decline"} disabled={busy} variant={response === "decline" ? "primary" : "quiet"} onClick={() => onRespond("decline")}>
            Decline ownership
          </Button>
          {response && <span role="status" className="text-sm text-muted">You {response === "accept" ? "accepted" : "declined"} this.</span>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {claim.evidence.length === 0 ? (
          <span className="text-xs text-muted">No source quote. This stays a question until someone answers it.</span>
        ) : (
          claim.evidence.map((e) => <CitationChip key={`${e.chunk_id}:${e.quote}`} evidence={e} onOpen={onOpenCitation} />)
        )}
      </div>
    </article>
  );
}
