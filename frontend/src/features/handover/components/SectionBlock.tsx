import { Button } from "@/shared/ui";
import type { ClaimView, EvidenceView, SectionView } from "../api";
import { ClaimCard } from "./ClaimCard";

interface Props {
  section: SectionView;
  canAcknowledge: boolean;
  responses: Record<string, "accept" | "decline">;
  pending: boolean;
  onAcknowledge: (section: string) => void;
  onRespond: (claim: ClaimView, response: "accept" | "decline") => void;
  onOpenCitation: (evidence: EvidenceView) => void;
}

export function SectionBlock({ section, canAcknowledge, responses, pending, onAcknowledge, onRespond, onOpenCitation }: Props) {
  const headingId = `section-${section.key}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="font-display text-2xl text-olive">{section.title}</h2>
        {canAcknowledge &&
          (section.acknowledged_at ? (
            <span role="status" className="text-sm text-muted">Receipt stored {new Date(section.acknowledged_at).toLocaleString()}</span>
          ) : (
            <Button variant="quiet" disabled={pending} onClick={() => onAcknowledge(section.key)}>
              Acknowledge this section
            </Button>
          ))}
      </div>
      {section.claims.map((claim) => (
        <ClaimCard
          key={claim.claim_id}
          claim={claim}
          canRespond={canAcknowledge}
          response={responses[claim.claim_id]}
          busy={pending}
          onRespond={(r) => onRespond(claim, r)}
          onOpenCitation={onOpenCitation}
        />
      ))}
    </section>
  );
}
