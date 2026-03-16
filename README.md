SPIN UP INSTRUCTIONS

TO RUN FRONTEND (development):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in a modern desktop browser.

BACKEND IS FULLY HOSTED ON GOOGLE CLOUD. TO RUN BACKEND (development):
```bash
cd backend
npm install
npx ts-node src/index.ts
```
## System Requirements

- **OS:** macOS, Linux, or Windows (64-bit).
- **CPU / RAM:** 4+ CPU cores; 8+ GB RAM recommended for local dev (16 GB for heavy workloads).
- **Browser:** Latest Chrome, Edge, or Safari (desktop) with camera + mic access.
- **Node:** Node.js 18+ (20 LTS recommended). Use `npm`, `pnpm`, or `yarn`.
- **Package manager:** `npm` (>=8) or `pnpm` if you prefer (repo contains `pnpm-lock.yaml`).
- **Backend dev tools:** `npx`/`ts-node` (for `npx ts-node src/index.ts`), TypeScript.
- **Docker & gcloud:** `docker` and `gcloud` CLI for Cloud Run deployment.
- **Cloud credentials / env vars:** Provide these as environment variables or Cloud Secret Manager (do NOT commit):
	- `GENAI_API_KEY`
	- `FIREBASE_SERVICE_ACCOUNT_JSON`
	- `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`
	- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_FIT_REDIRECT_URI`
	- `NEXT_PUBLIC_BACKEND_URL`,
- **Ports (dev):** Frontend `3000`, Backend `8080`
- **Hardware (media):** Webcam and microphone for live agent testing.

OVERVIEW
—
MedLens is a desktop-first web prototype for a live multimodal medication-safety assistant. The frontend captures webcam frames and microphone audio and streams them to a backend AI agent. The backend proxies to Google GenAI (Gemini Live) for live interaction, can draft/send emails via Gmail, and can deploy a voice-call agent (VAPI) to contact clinics or pharmacies. Post-session summarization is provided by a summary service in the backend that uses Gemini Flash Lite.

Important current facts (2026-03-14)
—
- `backend/src/index.ts` is the main deployed backend (Cloud Run). It implements the WebSocket server, Gemini Live proxy, Gmail draft/send helpers, and VAPI call endpoints. It also contains the summary logic.
- The repository currently contains sensitive keys in `backend/.env` which is not committed to GitHub.

Quick references
—
- Live capture and session UI: `frontend/components/medlens/session-view.tsx`
- WS client + audio: `frontend/hooks/use-live-agent.ts`
- Summary dashboard & VAPI sync: `frontend/components/medlens/summary-dashboard.tsx`
- Deployed backend entry: `backend/src/index.ts`

Environment & configuration (summary)
—
Set these in your environment or Cloud Run secrets. Do NOT commit them:

Required/important variables:

- `GENAI_API_KEY` — Gemini Live API key
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firestore admin credentials (JSON string)
- `VAPI_API_KEY` and `VAPI_PHONE_NUMBER_ID` — vapi.ai credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_FIT_REDIRECT_URI` — used for Google Fit OAuth
- `NEXT_PUBLIC_BACKEND_URL` — frontend → backend WS url (wss://...) in production

Production deployment notes
—
Recommended Cloud Run flags for the backend (long-lived sessions):

```bash
gcloud run deploy medlens-backend \
	--source . \
	--region us-central1 \
	--allow-unauthenticated \
	--timeout=3600 \
	--session-affinity \
	--min-instances=1 \
	--quiet
```
