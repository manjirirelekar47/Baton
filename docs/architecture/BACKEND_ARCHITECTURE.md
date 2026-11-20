# Baton — Backend Architecture Specification

## 1. Architectural Philosophy & Principles

The **Baton Backend** is engineered as a high-performance, contract-driven modular monolith implemented in **Python 3.11+** using **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0**.

The architecture adheres strictly to **Domain-Driven Design (DDD)** principles with explicit public boundaries between modules (`public.py` interfaces). No module is permitted to query internal tables or private helper functions of another module.

---

## 2. Directory Structure & Modular Breakdown

```
backend/app/
├── core/                              # Cross-cutting foundational infrastructure
│   ├── audit_log.py                   # Append-only tamper-evident audit logger
│   ├── config.py                      # Environment and secrets manager (Pydantic Settings)
│   ├── db.py                          # Database session factory & connection pooling
│   ├── errors.py                      # Canonical error hierarchy & HTTP status mappings
│   ├── routes.py                      # Health check (/health) and system telemetry
│   └── security.py                    # JWT decoding, RBAC enforcement, ACL validation
│
├── modules/                           # Domain-driven feature slices
│   ├── ask/                           # Evidence-grounded Natural Language Q&A
│   │   ├── router.py                  # POST /ask endpoint
│   │   └── service.py                 # Grounded semantic matching against approved claims
│   │
│   ├── drift/                         # Source drift detection & change alerts
│   │   ├── router.py                  # POST /drift/scan, GET/POST /drift/alerts
│   │   └── service.py                 # Deterministic SHA-256 chunk hash diffing
│   │
│   ├── extraction/                    # Fact & Claim Extraction Pipeline
│   │   ├── router.py                  # POST /extraction/run endpoint
│   │   └── service.py                 # Chunk parsing, candidate quotes, entity attribution
│   │
│   ├── handover/                      # Transition Package & Roadmap Generator
│   │   ├── router.py                  # GET /handover/latest, POST /handover/tasks
│   │   └── service.py                 # Day-1/Week-1/Month-1 execution plan synthesis
│   │
│   ├── ingestion/                     # Multi-Format Ingestion & Connectors
│   │   ├── connectors/                # GitHub API & Jira Cloud JQL sync connectors
│   │   ├── parsers/                   # PDF, DOCX, TXT, MD, Git JSON, Task CSV parsers
│   │   ├── router.py                  # POST /sources, GET /sources, OAuth endpoints
│   │   ├── service.py                 # Secret redaction, chunking, content-hashing
│   │   └── public.py                  # Ingestion public interface (ACL-filtered chunks)
│   │
│   ├── review/                        # Review Queue & Conflict Resolution
│   │   ├── router.py                  # GET /review/queue, POST /review/{id}/action, /approve
│   │   ├── service.py                 # Disagreement solver, Gap interview, Version sealing
│   │   └── public.py                  # Review public interface
│   │
│   ├── risk/                          # Risk Radar & Knowledge Graph Engine
│   │   ├── router.py                  # GET /risk/radar, GET /risk/timeline, GET /risk/graph
│   │   ├── service.py                 # Bus-factor, single-owner detection, Cytoscape graph
│   │   └── public.py                  # Risk public interface
│   │
│   └── verification/                  # Verification & Citation Engine
│       ├── router.py                  # POST /verification/verify endpoint
│       ├── service.py                 # Verbatim quotation checks & confidence grading
│       └── public.py                  # Verification public interface
│
└── main.py                            # FastAPI application factory, middleware, CORS
```

---

## 3. Subsystem Deep Dive

### 3.1. Ingestion Engine (`app/modules/ingestion`)
- **Multi-Format Parsers**: Supports PDF, Microsoft Word (`.docx`), Markdown (`.md`), Plain Text (`.txt`), Git JSON exports, and Task CSVs.
- **Automated PII & Secret Redaction**: Before storing chunks, an automated regex and pattern-matching filter scrubs AWS access keys, GitHub tokens, JWTs, private keys, passwords, email addresses, and phone numbers.
- **Strict L4 Rejection**: If an uploaded file is labeled `L4` (Private Secrets & Keys), the ingestion pipeline rejects the upload with a `400 Bad Request` before writing any bytes to disk or database.
- **Deterministic Chunking**: Text is segmented into chunks with preserved metadata (`author`, `event_time`, `source_type`, `char_start`, `char_end`) and an immutable `content_hash` (SHA-256).
- **Live Sync Connectors**:
  - **GitHub Connector**: Syncs commit history, pull request discussions, and issue trackers.
  - **Jira Cloud Connector**: Uses enhanced JQL queries with paginated API endpoints.

---

### 3.2. Extraction Pipeline (`app/modules/extraction`)
- **Entity & Attribute Mapping**: Extracts structured tuples from ingested chunks: `(entity_key, attribute, value)`.
- **Verbatim Quote Slicing**: Every extracted claim must cite an exact character substring from its supporting chunk.
- **Project Claim Reconstruction**: Automatically extracts verifiable claims with verbatim citations whenever new project documents are uploaded.

---

### 3.3. Verification & Citation Engine (`app/modules/verification`)
- **"Citation or Silence" Rule**: A claim cannot enter the Claim Ledger without a valid citation:
  $$\text{MatchScore}(Q, C) = \begin{cases} 1.0 & \text{if } Q \subseteq C \\ \text{Sim}(Q, C) & \text{if whitespace normalized} \\ 0.0 & \text{otherwise} \end{cases}$$
- **Confidence Grades**:
  - **Strong**: Exact verbatim quote match in primary source chunk with verified author provenance.
  - **Partial**: Normalized whitespace match or secondary source citation.
  - **Weak / Missing**: Candidate quote cannot be found in the referenced chunk; marked for human review.
- **Honesty Classifications**: `Verified`, `Inferred`, `Conflicting`, `Missing`, `Attested`.

---

### 3.4. Review & Version Sealing (`app/modules/review`)
- **Review Queue**: Aggregates pending claims, flagged inferences, and contradictions.
- **Side-by-Side Conflict Resolution**: Contrasts two conflicting claims citing different sources. The Approver selects the winner or accepts the uncertainty with a mandatory rationale note.
- **Gap Interview Workflow**: Approvers can route open questions to departing leavers. Leavers are sandboxed exclusively to answering these questions.
- **Version Snapshot Sealing**: When the Approver clicks "Approve & Seal", the current ledger is serialized into canonical JSON and hashed with SHA-256. This snapshot is completely immutable.

---

### 3.5. Risk Radar & Knowledge Graph (`app/modules/risk`)
- **Deterministic Bus-Factor**: Calculates ownership concentration exclusively from Git commits and PR authorships. Identifies modules where a single contributor authored $\ge 70\%$ of the codebase.
- **Knowledge Graph Synthesis**: Constructs a multi-entity bipartite graph:
  - **Nodes**: `Person`, `Module`, `Task`, `Claim`, `Source`.
  - **Edges**: `AUTHORED`, `OWNS`, `IMPORTS`, `BLOCKS`, `SUPPORTED BY`.
  - Filtered strictly against template placeholders (e.g. `Member 3 Full Name`).
- **Commit Timeline Pagination**: Formats Git commits into clean, searchable timeline events with derived module names (e.g., `ingestion`, `payments`, `forecasting`).

---

### 3.6. Drift Detection Engine (`app/modules/drift`)
- **Baseline Recording**: Stores an initial content hash of each ingested source.
- **Deterministic Hash Comparison**: Chunks are sorted by `(event_time, char_start, chunk_id)` to ensure identical chunk sets generate identical hashes across re-imports.
- **Change Alerts**: Triggers a persistent alert (`POST /drift/alerts`) when a re-imported source detects changed, added, or deleted chunks.

---

### 3.7. Ask Baton Engine (`app/modules/ask`)
- **Evidence-Grounded Q&A**: Queries are matched against verified claims in the latest approved handover version.
- **Zero Hallucination Guarantee**: Returns answers paired directly with verbatim source citations. If no verified claims match the query, the engine returns an explicit abstention.

---

## 4. API Endpoints Reference

| Subsystem | Method | Path | Description | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Core** | `GET` | `/health` | System health, telemetry, database and storage engine | Public |
| **Ingestion** | `POST` | `/sources` | Upload file (PDF, DOCX, TXT, MD, CSV) with consent | Approver |
| | `GET` | `/sources` | List project sources filtered by user ACL clearance | L1–L3 |
| | `POST` | `/sources/sync/github` | Trigger live GitHub repository sync | Approver |
| | `POST` | `/sources/sync/jira` | Trigger live Jira Cloud issue sync | Approver |
| **Extraction**| `POST` | `/extraction/reconstruct`| Reconstruct project claims from ingested chunks | Approver |
| **Review** | `GET` | `/review/queue` | List pending claims, conflicts, and inferences | L1–L3 |
| | `POST` | `/review/{claim_id}/action` | Confirm, reject, edit, or resolve claim | Approver |
| | `POST` | `/review/approve` | Seal and freeze immutable handover version | Approver |
| | `GET` | `/review/gap-interview` | List questions for departing leaver | Leaver / Appr |
| | `POST` | `/review/gap-answers` | Submit leaver answers to gap interview | Leaver |
| **Risk** | `GET` | `/risk/radar` | Bus-factor concentration & module risk analysis | L1–L3 |
| | `GET` | `/risk/timeline` | Commit, PR, and issue activity timeline | L1–L3 |
| | `GET` | `/risk/graph` | Cytoscape.js knowledge graph nodes and edges | L1–L3 |
| **Handover** | `GET` | `/handover/latest` | Retrieve latest approved transition package | L1–L3 |
| | `POST` | `/handover/tasks/{id}` | Update Day-1/Week-1/Month-1 task status | L1–L2 |
| **Drift** | `POST` | `/drift/scan` | Scan sources for content drift against baseline | Approver |
| | `GET` | `/drift/alerts` | List active source change alerts | Approver |
| **Ask** | `POST` | `/ask` | Grounded Q&A against approved handover facts | L1–L3 |
| **Audit** | `GET` | `/audit` | Append-only audit logs with SHA-256 verification | Approver |

---

## 5. Automated Test Suite

The backend test suite is executed with `pytest` and maintains **273 / 273 passing tests** across 8 core test suites:

```text
backend/tests/
├── core/                  # Security, RBAC, tenant isolation, health API (16 tests)
├── ingestion/             # PDF/DOCX parsing, secret redaction, chunk hashing (42 tests)
├── extraction/            # Entity extraction, quote matching, reconstruction (34 tests)
├── verification/          # Citation-or-silence, confidence grades (38 tests)
├── review/                # Review queue, conflict resolution, version sealing (118 tests)
├── risk/                  # Bus-factor, knowledge graph, commit timeline (15 tests)
├── handover/              # Transition roadmaps, task checklists (8 tests)
└── drift/                 # Deterministic hashing, change alerts (2 tests)
```
