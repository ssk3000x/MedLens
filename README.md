TO RUN FRONTEND:
cd frontend
npm run dev

TO RUN BACKEND:
cd backend
npx ts-node src/index.ts

# MedLens — Live Multimodal Medication Safety Agent

MedLens is a desktop-first, zero-install web app prototype that demonstrates a live, multimodal medication-safety agent. Users hold a medication bottle up to their webcam, speak naturally, and receive an interruptible, grounded safety check that can draft emails to clinicians.

This repo contains the Next.js frontend (UI, capture, WebSocket client). The Node.js backend that brokers Gemini Live, Vertex Search Grounding, Firestore, and Gmail is expected to live in a sibling `server/` folder or separate repo (see `agents.md` for integration details).

## Features (MVP)
- Real-time webcam frame snapshots sent inline over WebSocket
- Continuous audio streaming to a backend agent (planned)
- UI state machine: `landing`, `session`, `summary`
- Demo-ready flows: visual interaction check, live interruption, draft-email action

See `agents.md` for the full agent architecture, system prompts, grounding rules, and developer notes.

## Quick Start (frontend)
Prerequisites:
- Node.js (recommended 18+)
- pnpm (preferred) or npm

Install and run the frontend:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 in a modern desktop browser.

Notes:
- The frontend expects a backend WebSocket endpoint (see `BACKEND_URL` environment variable described below). By default the UI is frontend-only — actions that require a live backend (Gemini, Grounding, Gmail) will be no-ops unless a backend is available.

## Environment & Secrets (example)
The frontend and backend require several environment variables. Keep secrets out of source control and use a secure secret manager for production.

Recommended environment variables:

```bash
GOOGLE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON='file://path/to/serviceAccount.json'
GENAI_API_KEY=
GMAIL_SERVICE_ACCOUNT_JSON='file://path/to/gmail-sa.json'
BACKEND_URL=wss://your-cloud-run.example/ws
```

## Where to look in this repo
- App entry: `app/layout.tsx`, `app/page.tsx`
- Live UI & capture: `components/medlens/session-view.tsx`
- Landing & content: `components/medlens/*` (hero, features, safety, footer)
- Summary dashboard: `components/medlens/summary-dashboard.tsx`
- UI primitives: `components/ui/*`
- Utilities: `lib/utils.ts`
- Agents & integration docs: `agents.md`

## Backend expectations (summary)
- Node.js backend using Google GenAI SDK to manage Gemini Live sessions via a persistent WebSocket connection.
- Responsibilities: forward frames as `realtime_input`, handle audio streaming, run Vertex Search Grounding on medical queries, fetch user meds from Firestore, draft emails via Gmail API.
- Cloud Run deployment must use `--min-instances=1`, longer timeouts (e.g., `--timeout=3600`), and HTTP/2 for streaming.

## Testing & Development tips
- For rapid iteration, build a small local WebSocket stub that simulates backend messages (agent_speech_start/agent_speech_chunk/agent_speech_end, grounding_results, draft_email).
- Record and replay WebSocket sessions (frames + audio) for E2E tests.
- Unit-test grounding logic by mocking Vertex Search responses and asserting the UI blocks non-authoritative results.

## Deployment notes
- Use Cloud Run (or equivalent) for the backend; ensure pre-warmed instances to meet live latency requirements.
- Use Cloud Secret Manager for sensitive credentials.
- Enable Google Cloud Logging to capture Firestore reads and Vertex tool calls for demo proof.

## Contribution
- Update `agents.md` when backend contracts, WS message schema, or deployment recommendations change.
- If adding backend code in a sibling folder, document the path and add integration tests that the frontend can use during CI.

## Contact
Add product owner and primary engineer contacts in `agents.md`.

---
This README is a starter guide. For the agent-specific details (system prompts, grounding rules, and WebSocket protocol) see `agents.md`.
