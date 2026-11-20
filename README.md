<div align="center">

<a href="https://baton-pearl.vercel.app/">
  <img src="frontend/public/baton-logo.png" alt="Baton Logo" width="100" height="100" style="border-radius: 20px;" />
</a>

# Baton

### _Every Handover with Proof. Capture. Verify. Transfer._

[![Live Demo](https://img.shields.io/badge/Live-Deployment-success?style=for-the-badge&logo=vercel)](https://baton-pearl.vercel.app/)
[![API Backend](https://img.shields.io/badge/API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://baton-dw2j.onrender.com/docs)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Backend Tests](https://img.shields.io/badge/Pytest-273%20Passed%20(100%25)-brightgreen?style=flat-square&logo=pytest)](backend/tests/)
[![Frontend Tests](https://img.shields.io/badge/Vitest-111%20Passed%20(100%25)-brightgreen?style=flat-square&logo=vitest)](frontend/src/__tests__/)
[![CI Status](https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square&logo=githubactions)](https://github.com/manjirirelekar47/Baton/actions)

<p align="center">
  <b>Baton</b> is an enterprise-grade knowledge continuity and engineering handover engine engineered to eliminate institutional brain drain when critical engineering talent transitions between teams or companies.<br />
  Transform scattered project records, Git commits, Jira boards, and architectural PDFs into a cryptographically verified, permission-aware <b>Claim Ledger</b> with automated Day-1/Week-1/Month-1 onboarding roadmaps.
</p>

<p align="center">
  <a href="https://baton-pearl.vercel.app/"><b>🚀 Launch Live Demo</b></a> •
  <a href="#-features"><b>✨ Features</b></a> •
  <a href="#-system-architecture"><b>🏗️ System Architecture</b></a> •
  <a href="#-frontend-architecture"><b>🎨 Frontend Architecture</b></a> •
  <a href="#-backend-architecture"><b>⚙️ Backend Architecture</b></a> •
  <a href="#-quickstart--local-development"><b>⚡ Quickstart</b></a> •
  <a href="#-api-routes-reference"><b>🔌 API Reference</b></a> •
  <a href="https://github.com/manjirirelekar47/Baton/issues"><b>🐛 Report Issue</b></a>
</p>

</div>

---

### 👑 Project Leadership & Core Team

| Leader / Author | Role & Subsystem Ownership | GitHub | Badges |
| :--- | :--- | :--- | :--- |
| **Manjiri Relekar** | 🚀 **Lead Architect & Submission Lead**<br>Project scoping, integration review, core orchestration | [@manjirirelekar47](https://github.com/manjirirelekar47) | [![GitHub Profile](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/manjirirelekar47) |
| **Bhavesh Patil** | 🛡️ **Ingestion, Risk Radar & UI Architecture**<br>Sources engine (F1/F2), Risk radar (F6), Cytoscape graph, live connectors, telemetry | [@bhavesh-patil2007](https://github.com/bhavesh-patil2007) | [![GitHub Profile](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/bhavesh-patil2007) |
| **Samiksha Patil** | 🔍 **Reconstruct & Verify Core**<br>Extraction pipeline (F3), Claim ledger (F4), Verification engine (F5) | [@samiksha-patil](https://github.com/samiksha-patil) | [![GitHub Profile](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/samiksha-patil) |
| **Samruddhi Gangane**| 📋 **Review Queue & Release Readiness**<br>Disagreement solver, gap interview, handover sealing, E2E tests | [@samruddhigangane17](https://github.com/samruddhigangane17) | [![GitHub Profile](https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github)](https://github.com/samruddhigangane17) |

---

## 📋 Table of Contents

- [💡 The Pitch](#-the-pitch)
- [✨ Key Features](#-features)
  - [🛡️ "Citation or Silence" Verification Engine](#️-citation-or-silence-verification-engine)
  - [📡 Risk Radar & Bus-Factor Analyzer](#-risk-radar--bus-factor-analyzer)
  - [🕸️ Interactive Cytoscape Knowledge Graph](#️-interactive-cytoscape-knowledge-graph)
  - [⚡ Multi-Source Ingestion & Live Sync](#-multi-source-ingestion--live-sync)
  - [📋 Approval Checklist & Disagreement Resolver](#-approval-checklist--disagreement-resolver)
  - [🔒 L1–L4 Multi-Tiered Least-Privilege Access Control](#-l1l4-multi-tiered-least-privilege-access-control)
  - [🗺️ Role-Specific Onboarding Roadmaps](#️-role-specific-onboarding-roadmaps)
  - [💬 Ask Baton Grounded Knowledge Q&A](#-ask-baton-grounded-knowledge-qa)
  - [🔍 Cryptographic Drift & Change Alert Engine](#-cryptographic-drift--change-alert-engine)
  - [📜 Tamper-Evident Append-Only Audit Trail](#-tamper-evident-append-only-audit-trail)
  - [🎨 Dual-Theme Parity (Cinematic Dark & Clean Light)](#-dual-theme-parity)
- [🌟 Core Platform Capabilities](#-core-platform-capabilities)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ System Architecture](#-system-architecture)
- [🎨 Frontend Architecture](#-frontend-architecture)
- [⚙️ Backend Architecture](#-backend-architecture)
- [🔐 Role-Based Access Control (RBAC) Matrix](#-role-based-access-control-rbac-matrix)
- [📱 Application Views & Pages](#-application-views--pages)
- [🔌 API Routes Reference](#-api-routes-reference)
- [⚡ Quickstart & Local Development](#-quickstart--local-development)
- [🧪 Testing & Verification](#-testing--verification)
- [🔧 Troubleshooting](#-troubleshooting)
- [🔐 Environment Variables](#-environment-variables)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 💡 The Pitch

When a critical engineering lead or staff architect departs a team, undocumented architectural decisions, tribal knowledge, and critical single-owner dependencies walk out the door with them.

**Baton** eliminates engineering continuity risk forever. By ingesting, cross-referencing, and cryptographically linking claims directly to verbatim sources across Jira, GitHub, Slack, and architectural documentation, Baton reconstructs an immutable, permission-aware project state. Every fact is backed by evidence, verified through human approval workflows, and transformed into role-specific Day-1, Week-1, and Month-1 transition roadmaps for incoming teams.

---

## ✨ Features

### 🛡️ "Citation or Silence" Verification Engine
- **Zero Hallucination Guarantee**: A fact is never accepted into the Claim Ledger without an exact or whitespace-normalized verbatim quote directly from an ingested source chunk. If evidence is lacking, the system abstains (**Silence**).
- **Deterministic Confidence Grades**: Assigns **Strong** (exact verbatim match in primary source), **Partial** (whitespace-normalized match), or **Weak** (candidate quote modified or unconfirmed) confidence scores.
- **Honesty Classifications**: Every claim is categorized as `Verified`, `Inferred`, `Conflicting`, `Missing`, or `Attested`.

### 📡 Risk Radar & Bus-Factor Analyzer
- **Deterministic Ownership Concentration**: Analyzes Git commit history and PR reviews to compute the bus-factor across codebase modules. Identifies single-owner risks where a single contributor authored $\ge 70\%$ of the module.
- **Commit Activity Timeline**: Formats recent Git commits into readable, searchable activity cards with module labels (e.g. `ingestion`, `payments`, `forecasting`), author badges, and 10-item pagination.
- **Upcoming & Blocked Task Chains**: Uncovers dependent task bottlenecks and stalled milestones from task boards before handover.

### 🕸️ Interactive Cytoscape Knowledge Graph
- **Hardware-Accelerated 2D Canvas**: Cytoscape.js canvas rendering with force-directed physics, zoom, pan, and fit-to-screen controls.
- **Typed Entity Clustering**: Distinct visual nodes for **People** (blue), **Modules** (purple), **Tasks** (green), **Claims** (amber), and **Sources** (cyan).
- **Semantic Relationship Edges**: Explicit dependency links labeled `AUTHORED`, `OWNS`, `IMPORTS`, `BLOCKS`, and `SUPPORTED BY`.
- **Sanitized Entities**: Strict name validation filters out template placeholders (e.g., `Member 3 Full Name`).

### ⚡ Multi-Source Ingestion & Live Sync
- **Multi-Format Ingestion**: Supports PDF documents, Word (`.docx`), Markdown (`.md`), Plain Text (`.txt`), Git JSON exports, and Task CSV boards (< 10MB).
- **Live Source Syncing**: Read-only connectors for **GitHub** (commits, PRs, issues) and **Jira Cloud** (enhanced JQL issue search) with server-managed credentials and signed state verification.
- **Automated PII & Secret Redaction**: Ingestion pipeline scrubs API secrets, passwords, AWS keys, JWTs, phone numbers, and emails before chunk persistence.
- **Strict L4 Rejection**: Files marked with Clearance `L4` (Private Secrets & Keys) are rejected before being written to disk or database.

### 📋 Approval Checklist & Disagreement Resolver
- **Approval Readiness Bar**: Visual handover readiness score, blocker breakdown, and single-click "Confirm all verified".
- **Side-by-Side Conflict Resolver**: Contrasts contradictory claims citing conflicting sources. The Approver selects the winning claim or accepts the uncertainty with an audit rationale note.
- **Gap Interview Portal**: Approvers dispatch targeted questions to departing leavers. Departing engineers are securely sandboxed exclusively to the gap interview portal.
- **Version Snapshot Sealing**: One-click freezing of the verified Claim Ledger with canonical SHA-256 hash sealing.

### 🔒 L1–L4 Multi-Tiered Least-Privilege Access Control
- **Tiered Clearance Matrix**:
  - **L1 (Team-Wide)**: Public to all team roles (Contributors, Maintainers, Approvers).
  - **L2 (Maintainers Only)**: Architecture runbooks, internal deployment procedures, configuration keys.
  - **L3 (Leadership Only)**: Confidential budgets, compensation details, vendor contracts.
  - **L4 (Private Secrets & Keys)**: Strictly rejected and redacted at ingest; never persisted or rendered.
- **Information Hiding**: Lower-tier roles see confidential entries rendered only as non-revealing count placeholders (`Hidden (Count only)`).

### 🗺️ Role-Specific Onboarding Roadmaps
- **Personalized Transition Plans**: Automatically derives tailored transition milestones divided into:
  - **Day 1**: System access, repository setup, environment variables, and tool clearance.
  - **Week 1**: Architecture deep-dives, module dependencies, runbook execution, and code review flows.
  - **Month 1**: Module ownership transfer, architectural roadmap stewardship, and key milestone delivery.
- **Interactive Checklist**: Incoming engineers can track progress (`not_started`, `in_progress`, `blocked`, `completed`) with timestamped notes.

### 💬 Ask Baton Grounded Knowledge Q&A
- **Strictly Grounded Retrieval**: Answers natural language questions using only the verified facts from the latest approved handover snapshot.
- **Verbatim Evidence Citations**: Every answer provides direct quote chips opening the `SourceDrawer` with highlighted citations. Abstains if no verified claims match the query.

### 🔍 Cryptographic Drift & Change Alert Engine
- **Deterministic Chunk Hashes**: Chunks are sorted by `(event_time, char_start, chunk_id)` to ensure identical chunk sets produce identical SHA-256 hashes.
- **Drift Detection**: When a source is re-imported with the same name, Baton compares chunk hashes against the baseline, generating a change alert (`changed · 134 -> 138 chunks`) if content drifted.
- **Deduplication**: Re-uploading an identical file updates metadata in place without creating duplicate inventory rows or false drift alerts.

### 📜 Tamper-Evident Append-Only Audit Trail
- **Immutable Log Engine**: Every human review action (confirming a fact, resolving a disagreement, editing a statement) appends an immutable audit event with user attribution and timestamp.
- **Cryptographic Hash Verification**: The audit header validates database integrity against canonical SHA-256 state hashes.

### 🎨 Dual-Theme Parity
- **Cinematic Dark Glass Mode**: High-end translucent dark glassmorphism with glowing purple accents for focused developer deep-work.
- **Clean Enterprise Light Mode**: High-contrast, pristine slate canvas designed for executive handovers and enterprise compliance audits.

---

## 🌟 Core Platform Capabilities

| Capability | Experience | Technical Highlight |
| :--- | :--- | :--- |
| 🛡️ **Verbatim Quotation Proof** | Clicking any claim statement opens the exact document view with yellow quote highlighting. | Exact substring matching and character offset mapping against immutable source chunks. |
| 📡 **Bus-Factor Risk Radar** | Dynamic circular gauge highlighting single-owner engineering concentration risk. | Pure Git-based bus-factor heuristic ($A \ge 70\%$ authored commits) with explainable signals. |
| 🕸️ **Cytoscape Knowledge Graph** | Interactive multi-entity relationship graph with custom cluster colors and layout controls. | High-performance HTML5 Canvas / Cytoscape.js engine with typed semantic edges. |
| 📋 **Disagreement Resolver** | Side-by-side claim comparison with conflicting source quotes and heuristic recommendations. | Approver choice arbitration with mandatory explanation note on uncertainty acceptance. |
| 🗺️ **Day-1/Week-1/Month-1 Roadmaps** | Progressive onboarding roadmaps with interactive task completion checkboxes. | Generated dynamically from verified ownership, dependency, and runbook claims. |
| 💬 **Ask Baton Q&A** | Grounded chatbot answering queries with direct citation chips. | Retrieval-augmented answering constrained strictly to the latest approved snapshot. |
| 🔒 **Least-Privilege RBAC** | Role-aware navigation, views, and masked claim cards across L1–L4 clearance tiers. | Central security middleware enforcing tenant isolation and role permissions. |
| 📜 **Tamper-Evident Audit Trail** | Chronological audit log viewer with dynamic pluralization and SHA-256 integrity indicator. | Append-only database event table with actor attribution and canonical snapshot hashing. |

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18.3 (Vite 5.4 SPA) | Ultra-fast client-side rendering with hot-module replacement |
| **Language** | TypeScript 5.6 | Strict end-to-end type safety matching backend Pydantic models |
| **Styling & Icons** | Tailwind CSS 3.4, Lucide React | Responsive dark glassmorphism and accessible light themes |
| **State & Cache** | TanStack React Query v5 | Multi-tenant cache keying, optimistic updates, coordinated invalidations |
| **Visualizations** | Cytoscape.js, Three.js WebGL | Interactive 2D knowledge graphs and 3D hero canvas nodes |
| **Backend Framework** | FastAPI 0.115 (Python 3.11+) | High-performance asynchronous REST API with OpenAPI autodocs |
| **Validation & ORM** | Pydantic v2, SQLAlchemy 2.0 | Contract-driven request validation and ORM persistence |
| **Database** | PostgreSQL 16 / SQLite (WAL mode) | Robust ACID relational persistence with multi-tenant isolation |
| **Authentication** | Supabase Auth + Demo Personas | Email/password, OAuth (GitHub/Google), JWT sessions, demo personas |
| **Document Parsers** | PyPDF2, pdfminer.six, python-docx | High-fidelity text extraction with character offset tracking |
| **Testing** | Pytest, Vitest, Playwright E2E | 273 backend tests + 111 frontend tests (100% passing) |
| **Deployment** | Vercel (Frontend) + Render (Backend) | Global edge CDN delivery and auto-scaling container backend |

---

## 🏗️ System Architecture

Baton enforces strict domain separation, contract-driven APIs, and isolated module slices:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  BATON WEB CLIENT                                      │
│                                (React 18 + Vite SPA)                                   │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   Sources & Sync      │  │  Claim Ledger & Graph │  │ Review Queue & Disagreements│  │
│  │  - File Upload (PDF)  │  │  - Verbatim Highlights│  │  - Approval Checklist      │  │
│  │  - GitHub & Jira Sync │  │  - Cytoscape 2D Graph │  │  - Gap Interview (Leaver)  │  │
│  │  - Drift Alerts       │  │  - Filter & Search    │  │  - Version Sealing         │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   Risk Radar & Commits│  │  Handover Roadmaps    │  │  Access Control & Telemetry│  │
│  │  - Bus Factor (100%)  │  │  - Day-1/Week-1/Month-1│  │  - L1–L4 Clearance Matrix  │  │
│  │  - Commit Activity    │  │  - Exportable Markdown│  │  - Tamper-Evident Audit    │  │
│  │  - Blocked Tasks      │  │  - Ask Baton (Q&A)    │  │  - System Health Telemetry │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / JSON (JWT + X-Project-Id)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FASTAPI BACKEND MONOLITH                                │
│                                   (Python 3.11+)                                       │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ CORE ENGINE: Security Middleware, Role Verification, Project Isolation, Audit Log│  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │ Ingestion Engine │ -> │Extraction Pipeline│ -> │ Verification & Citation Engine   │  │
│  │ - PDF/DOCX/MD/CSV│    │ - Entity Extractor│    │ - Exact Quote Match              │  │
│  │ - Git/Jira Sync  │    │ - Claim Synthesizer│   │ - Confidence Grading             │  │
│  │ - Secret Redactor│    │ - Attribute Mapper│   │ - "Citation or Silence" Gate     │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────────────────────┘  │
│            │                                                       │                   │
│            ▼                                                       ▼                   │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │ Drift Engine     │    │ Risk Radar Engine│    │ Review & Handover Engine         │  │
│  │ - SHA-256 Hashes │    │ - Bus-Factor     │    │ - Review Queue & Conflicts       │  │
│  │ - Chunk Diffing  │    │ - Activity Graph │    │ - Leaver Gap Interview           │  │
│  │ - Change Alerts  │    │ - Blocked Chains │    │ - Version Snapshot Sealing       │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────────────────────┘  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DATA LAYER                                         │
│  ┌───────────────────────────────┐           ┌──────────────────────────────────────┐  │
│  │ PostgreSQL / SQLite (WAL)     │           │ Supabase Auth & Storage              │  │
│  │ - Sources & Source Chunks     │           │ - JWT Token Verification             │  │
│  │ - Claims, Citations, Gaps     │           │ - OAuth Providers (GitHub / Google)  │  │
│  │ - Versions & Audit Events     │           │ - User Session Management            │  │
│  └───────────────────────────────┘           └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

> 📖 **Read the deep dive:** See [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md) for full C4 models, sequence flows, and tenant isolation specifications.

---

## 🎨 Frontend Architecture

The frontend client is structured into domain-driven feature slices under `frontend/src/`:

```text
frontend/src/
├── api/                       # Typed HTTP client with automatic JWT & X-Project-Id headers
├── app/                       # Routing, ProtectedRoute guards, App Shell
├── components/                # Reusable UI primitives, modals, ThreeHeroNode
├── context/                   # Global React state (AuthContext, ThemeContext)
└── features/                  # Domain-Driven Feature Slices
    ├── access/                # L1-L4 Least-Privilege Access Matrix & dynamic clearance counts
    ├── audit/                 # Append-only audit logs with SHA-256 verification indicator
    ├── dashboard/             # Project state overview, KPI metrics, mini knowledge graph
    ├── graph/                 # Interactive Cytoscape.js 2D relationship explorer
    ├── handover/              # Transition package reader, Day-1/Week-1/Month-1 checklist, Ask Baton
    ├── ledger/                # Claim Ledger, honesty status filtering, SourceDrawer citations
    ├── review/                # Review Queue, Disagreement resolver, Gap Interview, Snapshot approval
    ├── risk/                  # Bus-factor meter, single-owner modules, commit/PR timeline
    ├── settings/              # Project telemetry, system health, active clearance badge
    └── sources/               # Source upload, GitHub/Jira sync, drift alerts, inventory table
```

> 📖 **Read the deep dive:** See [`docs/architecture/FRONTEND_ARCHITECTURE.md`](docs/architecture/FRONTEND_ARCHITECTURE.md) for bundle breakdown, query invalidation graphs, and layout performance.

---

## ⚙️ Backend Architecture

The Python backend is structured into modular feature slices under `backend/app/`:

```text
backend/app/
├── core/                      # Foundational services (db, security, audit_log, errors, routes)
└── modules/                   # Domain Modules (Communicating solely via public.py)
    ├── ask/                   # Evidence-grounded natural language Q&A
    ├── drift/                 # Deterministic SHA-256 chunk hash drift detection
    ├── extraction/            # Fact & claim extraction from source chunks
    ├── handover/              # Milestone roadmaps and version snapshot sealing
    ├── ingestion/             # File parsers (PDF, DOCX, etc.) & live sync connectors
    ├── review/                # Review queue, conflict resolution, gap interviews
    ├── risk/                  # Bus-factor analysis, commit timeline, knowledge graph
    └── verification/          # Verbatim quotation checks and confidence grading
```

> 📖 **Read the deep dive:** See [`docs/architecture/BACKEND_ARCHITECTURE.md`](docs/architecture/BACKEND_ARCHITECTURE.md) for database schema definitions, invariants, and API contracts.

---

## 🔐 Role-Based Access Control (RBAC) Matrix

Baton enforces strict least-privilege visibility and action permissions across 4 defined roles:

| Action / Capability | Approver | Incoming Maintainer | Contributor | Departing Leaver |
| :--- | :---: | :---: | :---: | :---: |
| **Upload Sources & Connect Live Sync** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **View L1 (Team-Wide) Facts** | ✅ Full | ✅ Full | ✅ Full | ❌ Sandboxed |
| **View L2 (Maintainer) Runbooks** | ✅ Full | ✅ Full | 🔒 Count Only | ❌ Sandboxed |
| **View L3 (Leadership) Confidential** | ✅ Full | 🔒 Count Only | 🔒 Count Only | ❌ Sandboxed |
| **Confirm, Edit & Reject Claims** | ✅ Yes | ❌ Read-Only | ❌ Read-Only | ❌ Sandboxed |
| **Resolve Conflicting Claims** | ✅ Yes | ❌ Read-Only | ❌ Read-Only | ❌ Sandboxed |
| **Approve & Seal Handover Snapshot** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Execute Day-1/Week-1/Month-1 Tasks**| ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Ask Baton Natural Language Q&A** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Sandboxed |
| **Participate in Leaver Gap Interview**| ❌ Dispatcher | ❌ No | ❌ No | ✅ Responder |

---

## 📱 Application Views & Pages

| Route | Page | Description |
| :--- | :--- | :--- |
| `/dashboard` | **Project Dashboard** | Real-time KPI counts, verified claims ratio, review queue status, mini knowledge graph. |
| `/sources` | **Sources & Connectors** | Direct file upload (PDF/DOCX), live GitHub & Jira sync cards, source change alerts, inventory table. |
| `/ledger` | **Claim Ledger** | Extracted facts and open questions, honesty filters, source quote drawer with highlighted text. |
| `/graph` | **Knowledge Graph** | Fullscreen Cytoscape.js graph linking people, code modules, tasks, claims, and source documents. |
| `/risk` | **Risk Radar & Timeline** | Bus-factor ownership concentration meter, commit activity timeline with pagination, blocked tasks. |
| `/review` | **Review Queue** | Handover checklist, approval bar, conflict resolver modal, gap interview question dispatch. |
| `/handover` | **Handover Package** | Approved transition documents, Day-1/Week-1/Month-1 onboarding roadmaps, Ask Baton Q&A. |
| `/access` | **Access Control** | L1–L4 clearance matrix, role permissions inspector, dynamic counts of public vs confidential details. |
| `/audit` | **Audit Logs** | Append-only chronological audit trail with user attribution, timestamps, and SHA-256 verification. |
| `/settings` | **Project Settings** | Active workspace details, backend telemetry, system health, and demo data reset. |

---

## 🔌 API Routes Reference

| Subsystem | Method | Path | Description | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Core** | `GET` | `/health` | Live engine, database, environment, and storage telemetry | Public |
| **Ingestion** | `POST` | `/sources` | Upload file (PDF, DOCX, TXT, MD, CSV) with consent & ACL | Approver |
| | `GET` | `/sources` | List project sources filtered by user ACL clearance | L1–L3 |
| | `POST` | `/sources/sync/github` | Trigger live GitHub commit, PR, and issue sync | Approver |
| | `POST` | `/sources/sync/jira` | Trigger live Jira Cloud JQL issue sync | Approver |
| **Extraction**| `POST` | `/extraction/reconstruct`| Reconstruct verifiable claims from project chunks | Approver |
| **Review** | `GET` | `/review/queue` | List pending claims, conflicts, and inferences | L1–L3 |
| | `POST` | `/review/{claim_id}/action` | Confirm, reject, edit, or resolve claim | Approver |
| | `POST` | `/review/approve` | Seal and freeze immutable handover version | Approver |
| | `GET` | `/review/gap-interview` | List open questions for departing leaver | Leaver / Appr |
| | `POST` | `/review/gap-answers` | Submit leaver answers to gap interview | Leaver |
| **Risk** | `GET` | `/risk/radar` | Bus-factor concentration & single-owner analysis | L1–L3 |
| | `GET` | `/risk/timeline` | Commit, PR, and issue activity timeline | L1–L3 |
| | `GET` | `/risk/graph` | Cytoscape.js knowledge graph nodes and edges | L1–L3 |
| **Handover** | `GET` | `/handover/latest` | Retrieve latest approved transition package | L1–L3 |
| | `POST` | `/handover/tasks/{id}` | Update Day-1/Week-1/Month-1 task status | L1–L2 |
| **Drift** | `POST` | `/drift/scan` | Scan sources for content drift against baseline | Approver |
| | `GET` | `/drift/alerts` | List active source change alerts | Approver |
| **Ask** | `POST` | `/ask` | Evidence-grounded Q&A against approved handover facts | L1–L3 |
| **Audit** | `GET` | `/audit` | Append-only audit logs with SHA-256 verification | Approver |

---

## ⚡ Quickstart & Local Development

### Prerequisites
- **Node.js 20+** (v20 or v22 LTS recommended)
- **Python 3.11+**
- **npm** or **pnpm**
- **Git**
- **Docker & Docker Compose** (Optional, for containerized run)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/manjirirelekar47/Baton.git
cd Baton
```

---

### Step 2: Backend Setup (`/backend`)
```bash
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements/base.txt -r requirements/dev.txt

# Run the FastAPI server with hot-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Verify the API is running at [http://localhost:8000/health](http://localhost:8000/health) or browse interactive Swagger docs at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### Step 3: Frontend Setup (`/frontend`)
Open a new terminal:
```bash
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Step 4: Docker Compose (Alternative Full-Stack)
To spin up the entire application (Postgres, FastAPI backend, and Vite frontend) in isolated containers:
```bash
docker compose up --build
```
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **API Backend**: [http://localhost:8000](http://localhost:8000)

---

## 🧪 Testing & Verification

Baton maintains rigorous test suites across both backend and frontend layers:

### Run Backend Tests (Pytest)
```bash
cd backend
pytest
```
- **273 / 273 tests passing** (100% pass rate) covering:
  - Security, tenant isolation, and RBAC middleware
  - Secret redaction and PDF/DOCX chunk parsers
  - Verbatim quotation validation ("Citation or Silence")
  - Review queue, conflict resolution, and version sealing
  - Bus-factor heuristic and Cytoscape knowledge graph construction
  - Deterministic drift hashing and change alert triggers

### Run Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
- **111 / 111 tests passing across 23 test suites** covering:
  - UI state management, role-switching, and auth providers
  - Clean project zero-state and active project hydration
  - Source upload, table alignment, and drawer quote highlighting
  - Cytoscape graph canvas interactions and layout controls

### Run Production Build Verification
```bash
cd frontend
npm run build
```
- Executes `tsc --noEmit` and Vite production bundling with zero errors.

---

## 🔧 Troubleshooting

### 1. Port 8000 or 5173 already in use
**Symptom:** `OSError: [Errno 48] Address already in use`  
**Solution:**
```bash
# Find and terminate process on port 8000 (macOS/Linux)
lsof -i :8000 | awk 'NR>1 {print $2}' | xargs kill -9
```

### 2. Missing Backend Environment Variables
**Symptom:** `pydantic_core.ValidationError` on app startup.  
**Solution:** Copy `.env.example` to `backend/.env` and verify database and token configurations:
```bash
cp .env.example backend/.env
```

### 3. Supabase Auth Redirect Mismatch
**Symptom:** OAuth returns an error or redirects to an invalid origin.  
**Solution:** In the Supabase Dashboard under **Authentication → URL Configuration**, add:
- `http://localhost:5173/**`
- `https://baton-pearl.vercel.app/**`

---

## 🔐 Environment Variables

Create `.env` in the `backend/` directory and `.env.local` in `frontend/`:

### Backend Configuration (`backend/.env`)
```env
APP_ENV=development
PORT=8000
DATABASE_URL=sqlite:///./baton_dev.db
# For PostgreSQL: postgresql+psycopg2://user:password@localhost:5432/baton
JWT_SECRET_KEY=super-secret-jwt-key-replace-in-production
GITHUB_SYNC_TOKEN=optional_github_personal_access_token
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER_EMAIL=user@company.com
JIRA_API_TOKEN=your_jira_api_token
INGEST_ENABLE_CHAT=false
```

### Frontend Configuration (`frontend/.env.local`)
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

---

## 🤝 Contributing

Contributions to Baton are warmly welcomed! Please read our [Contributing Guide](CONTRIBUTING.md) and adhere to our strict architectural invariants:
1. **Never bypass "Citation or Silence"**: Every claim must link to a verifiable quote chunk.
2. **Never persist L4 secrets**: Scrub sensitive keys and credentials before chunk storage.
3. **Preserve tenant isolation**: Always include `project_id` and test for cross-project 404 boundaries.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with precision for engineering teams that value continuity.**

© 2026 Baton Inc. All rights reserved.

</div>
