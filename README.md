<div align="center">

<img src="./frontend/public/baton-logo.png" alt="Baton Logo" width="120" />

# Baton

### *Every Handover with Proof. Capture. Verify. Transfer.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)

<p align="center">
  <b>Baton is an enterprise knowledge handover platform that guarantees zero institutional brain drain when talent shifts, powered by verifiable, evidence-linked knowledge continuity.</b>
</p>

---

</div>

## 💡 The Pitch

When critical engineering leads and talent transition between teams or companies, undocumented architectural decisions, tribal knowledge, and critical ownership walk out the door.

**Baton** eliminates engineering continuity risk forever. By ingesting, cross-referencing, and cryptographically linking claims directly to verbatim sources across Jira, GitHub, Slack, and architectural documentation, Baton reconstructs an immutable, permission-aware project state. Every fact is backed by evidence, verified through human approval workflows, and transformed into role-specific Day-1, Week-1, and Month-1 transition roadmaps for incoming teams.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🛡️ Evidence-Backed AI Summaries** | **Zero unverified claims.** Every single fact is paired with verbatim quote citations, source chunks, and honesty classifications (`Verified`, `Inferred`, `Conflicting`, `Missing`, `Attested`). |
| **📡 Risk Radar** | Instant real-time detection of high-risk knowledge concentration, single-owner modules, orphan dependencies, and stalled delivery milestones before offboarding occurs. |
| **📋 Automated Review & Access** | Interactive review queue featuring side-by-side disagreement resolution, uncertainty acceptance, and a strict Handover Checklist to seal tamper-evident records. |
| **🔒 Least-Privilege Access Control (L1–L4)** | Tiered row-level security where sensitive credentials and financial details are redacted at ingest, ensuring contributors only see what their clearance permits. |
| **🗺️ Role-Specific Onboarding Roadmaps** | Automatically generates personalized Day-1, Week-1, and Month-1 execution plans tailored for incoming maintainers, contributors, and engineering leaders. |
| **📜 Tamper-Evident Audit Trail** | Every review decision (confirming facts, fixing disagreements, editing details) produces an append-only audit event with user and timestamp attribution. |

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with pure light/dark mode design system
- **Animation & 3D:** [Framer Motion](https://www.framer.com/motion/) & Native [Three.js](https://threejs.org/)
- **State & Data Fetching:** [TanStack React Query v5](https://tanstack.com/query/latest)
- **Icons & Visuals:** Lucide Icons & Custom SVG Glassmorphic UI

### Backend & Infrastructure
- **Runtime:** [Python 3.11+](https://www.python.org/)
- **API Framework:** [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
- **Data Validation & Schemas:** [Pydantic v2](https://docs.pydantic.dev/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (production) / [SQLite WAL](https://www.sqlite.org/) (instant zero-config local dev)
- **Authentication:** [Supabase Auth](https://supabase.com/) (OAuth, Email/Password, Sessions) & JWT
- **Containerization:** [Docker](https://www.docker.com/) & Docker Compose

---

## 🚀 Quick Start Guide

Follow these steps to run Baton locally on your machine in under two minutes.

### Prerequisites
- **Node.js** `>= 18.0.0` and **npm** `>= 9.0.0`
- **Python** `>= 3.11`
- **Git**

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/baton.git
cd baton
```

---

### 2. Backend Setup (`/backend`)

The FastAPI backend runs with zero configuration out of the box using local SQLite:

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# Install core and development dependencies
pip install -r requirements.txt -r requirements/dev.txt

# Start the FastAPI server on http://localhost:8000
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> **API Health Check:** Verify the backend is active by opening [http://localhost:8000/health](http://localhost:8000/health) or browsing the interactive OpenAPI documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 3. Frontend Setup (`/frontend`)

Open a new terminal window:

```bash
# Navigate to the frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server on http://localhost:5173
npm run dev
```

---

### 4. Supabase Environment Setup (Optional)

Baton includes pre-seeded demo personas so you can explore the entire platform without external services. To enable production Supabase Authentication (OAuth, magic links, email verification):

1. Copy the example environment file:
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```
2. Open `frontend/.env.local` and provide your project credentials:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
   ```
3. Restart the Vite development server.

---

### 5. Docker Alternative (Full Stack)

To run the entire platform (PostgreSQL, FastAPI Backend, and Frontend) in isolated containers:

```bash
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API Backend:** [http://localhost:8000](http://localhost:8000)

---

## 🏛️ Project Architecture

Baton enforces strict separation of concerns, contract-driven APIs, and isolated domain modules:

```text
baton/
├── backend/                       # FastAPI Python 3.11 Backend
│   ├── app/
│   │   ├── core/                  # Security, configuration, and database session
│   │   ├── modules/               # Domain-driven feature slices
│   │   │   ├── ingestion/         # Connectors for Jira, GitHub, Slack, Confluence
│   │   │   ├── extraction/        # Claim and relationship extraction pipeline
│   │   │   ├── verification/      # Verbatim quotation checks & hashing
│   │   │   ├── review/            # Conflict resolution & review queue engine
│   │   │   ├── risk/              # Single-owner detection & timeline analysis
│   │   │   ├── handover/          # Day-1/Week-1/Month-1 roadmap generation
│   │   │   └── ask/               # Evidence-grounded natural language Q&A
│   │   └── main.py                # FastAPI entry point and router registry
│   └── requirements/              # Base, dev, and production dependencies
│
├── frontend/                      # React 18 + Vite TypeScript SPA
│   ├── public/                    # Logos, SVG assets, and static media
│   └── src/
│       ├── api/                   # Typed API client and endpoint bindings
│       ├── app/                   # App Shell, routing, and auth bindings
│       ├── components/            # Reusable UI primitives, modals, and layouts
│       ├── context/               # Global state (ThemeContext, AuthContext)
│       ├── features/              # Feature-driven UI modules
│       │   ├── ledger/            # Project Facts & Open Questions explorer
│       │   ├── review/            # Handover Checklist & Disagreement solver
│       │   ├── risk/              # Risk warnings, ownership radar, delivery timeline
│       │   ├── handover/          # Transition document reader & milestone plans
│       │   ├── access/            # L1-L4 Permission matrix & visibility rules
│       │   └── audit/             # Tamper-evident activity trail
│       └── pages/                 # Unified AuthPage (Login/SignUp) and Dashboards
│
├── contracts/                     # JSON schema specifications and sample fixtures
└── tests/                         # End-to-end integration test suites
```

---


**Built with precision for engineering teams that value continuity.**

© 2026 Baton Inc. All rights reserved.

</div>
