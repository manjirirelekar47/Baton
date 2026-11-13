# Samruddhi: Review and Quality slice (F7, F8 gate)

## What this slice delivers

1. **Backend Review Engine**:
   - Risk-sorted review queue prioritizing high-risk and conflicting items.
   - Comprehensive review actions: `confirm`, `edit`, `reject`, `mark_unknown`, `ask_leaver`, `resolve_conflict`, `accept_uncertainty`.
   - Readiness gate (`compute_readiness`) ensuring all conflicts are resolved and uncorroborated inferred claims have explicit uncertainty rationale before approval.
   - Version approval generating an immutable frozen snapshot with SHA-256 canonical JSON hash (`snapshot_hash`).
   - Append-only database tables (`reviews`, `review_events`, `versions`, `version_claims`, `gap_answers`) protected by ORM update/delete interceptors and DB constraints.
   - Leaver Gap Interview workflow with automatic regex redaction of secrets (AWS keys, OpenAI tokens, GitHub credentials, passwords, contact details) before persistence as Attested claims.
   - Dual-recorded audit trail logging to both `review_events` and `core.audit_log`.

2. **Frontend Review Feature** (`frontend/src/features/review/`):
   - `ReviewPage`: Role-aware landing with tabbed queue filtering (`All`, `Pending`, `Conflicts`, `Inferred`, `Decided`), read-only views for incoming roles, and automatic Leaver redirection.
   - `ApprovalBar`: Visual readiness status badge, blockers breakdown, bulk "Confirm all verified" button, and version approval dialog with selective role sharing.
   - `ConflictModal`: Side-by-side comparison of conflicting claims displaying citation quotes, heuristic recommendations, radio selection for winning statement, or uncertainty acceptance with rationale.
   - `QueueItemCard`: Individual review card featuring state badges (color + symbol), risk explanation, citation chips opening `SourceDrawer` with highlighted quotes, and action buttons.
   - `EditDialog`: Claim statement editing modal requiring audit rationale and triggering re-verification.
   - `AcceptUncertaintyDialog`: Modal enforcing mandatory explanation note before admitting unresolved uncertainty into the handover.
   - `AskLeaverDialog`: Approver interface to route clarifying questions to the leaver's gap interview.
   - `GapInterviewView`: Leaver interface listing pending questions with confidentiality notices and character limits.
   - `AuditTrailModal` & `VersionHistoryModal`: Dedicated chronological log inspector and version snapshot explorer with hash validity indicator.

3. **Quality & End-to-End Suite** (`tests/e2e/` & `backend/tests/`):
   - `walkthrough.spec.ts`: Full 7-step Judge Walkthrough (demo load, citation highlighting, conflict inspection, approver resolution, snapshot approval, incoming contributor view with count placeholders, section acknowledgement and ownership acceptance).
   - `role_matrix.spec.ts`: Rigorous verification of visibility and access rules across Approver, Leaver, Incoming Maintainer, and Incoming Contributor against L1–L4 access labels.
   - `failures.spec.ts`: Robust failure tests verifying resilience against empty input, malformed payloads, fabricated quotes without evidence (citation or silence), prompt injection (inert storage as data, never instructions), source drift after approval, role revocation (immediate 403), and cross-project ID guessing (404 isolation).
   - Comprehensive backend test suite in `backend/tests/review/` with 118 passing tests covering 100% of review logic.

## Rules enforced in code

- **Approver exclusivity**: Only the Approver may confirm, reject, edit, resolve conflicts, or approve snapshots. The Leaver may only answer Gap questions.
- **Citation or silence**: A claim without verified evidence cannot be confirmed or shared as fact (returns 409 `citation_or_silence`).
- **Conflict gate**: Conflicting claims block approval until resolved by human choice or accepted with an explicit uncertainty rationale.
- **Human authority**: Heuristic suggestions are never applied automatically.
- **Immutability**: Approved versions and reviews are strictly append-only; ORM guards raise `ImmutableError` on update or delete attempts.
- **Cryptographic integrity**: Version snapshot hash is computed via canonical JSON SHA-256 and verified dynamically (`hash_valid`).
- **Information hiding**: L4 data is never rendered, stored, or counted. Foreign-project and unauthorized ID lookups return 404, never 403 or detailed leaks.

## Endpoints

- **Contract endpoints**: `GET /review/queue`, `POST /review/{claim_id}/action`, `POST /review/approve`, `GET /versions`, `GET /audit`.
- **Additive endpoints**: `GET /review/readiness`, `POST /review/confirm-verified`, `GET /versions/{id}`, `GET /review/gap-interview`, `POST /review/gap-answers`.

## Zero-Conflict Boundary Compliance

All code changes are strictly confined to Samruddhi's designated ownership boundaries:
- `backend/app/modules/review/`
- `backend/tests/review/`
- `db/schema/50_review.sql`
- `frontend/src/features/review/`
- `tests/e2e/`
- `docs/sections/samruddhi.md`

No modifications were made to frozen contracts, `backend/app/core/`, `backend/app/main.py`, `frontend/src/app/`, or teammate module files.
