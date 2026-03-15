TO RUN FRONTEND:
cd frontend
npm run dev
TO RUN FRONTEND (development):

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000 in a modern desktop browser.

TO RUN BACKEND (development):

```bash
cd backend
npx ts-node src/index.ts
```

OVERVIEW
—
MedLens is a desktop-first web prototype for a live multimodal medication-safety assistant. The frontend captures webcam frames and microphone audio and streams them to a backend AI agent. The backend proxies to Google GenAI (Gemini Live) for live interaction, can draft/send emails via Gmail, and can deploy a voice-call agent (VAPI) to contact clinics or pharmacies. Post-session summarization is provided by a separate summary service that uses Anthropic.

Important current facts (2026-03-14)
—
- `backend/src/index.ts` is the main deployed backend (Cloud Run). It implements the WebSocket server, Gemini Live proxy, Gmail draft/send helpers, and VAPI call endpoints.
- `backend/src/summary.ts` is a separate Express summarization service (Anthropic). It is typically run locally on port 8082 for development and is not automatically deployed with `index.ts`. The frontend uses `SUMMARY_SERVER_URL` to reach it.
- The repository currently contains sensitive keys in `backend/.env` — rotate and remove them. Treat any checked-in service account JSON or API keys as compromised.

Quick references
—
- Live capture and session UI: `frontend/components/medlens/session-view.tsx`
- WS client + audio: `frontend/hooks/use-live-agent.ts`
- Summary dashboard & VAPI sync: `frontend/components/medlens/summary-dashboard.tsx`
- Deployed backend entry: `backend/src/index.ts`
- Local summary server (dev): `backend/src/summary.ts`

Environment & configuration (summary)
—
Set these in your environment or Cloud Run secrets. Do NOT commit them:

Required/important variables:

- `GENAI_API_KEY` — Gemini Live API key
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firestore admin credentials (JSON string)
- `VAPI_API_KEY` and `VAPI_PHONE_NUMBER_ID` — vapi.ai credentials
- `ANTHROPIC_API_KEY` — used by `summary.ts`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_FIT_REDIRECT_URI` — used for Google Fit OAuth
- `NEXT_PUBLIC_BACKEND_URL` — frontend → backend WS url (wss://...) in production
- `SUMMARY_SERVER_URL` — frontend proxy to summary service (defaults to `http://localhost:8082` in dev)

Notes & gotchas
—
- The system prompt and tool declarations in `backend/src/index.ts` include behavior-enforcing instructions that should be audited and likely tightened for safety and policy compliance.
- Frontend encodes microphone audio as PCM16 @ 16000 Hz; ensure end-to-end sample rate expectations match.
- Gmail drafting currently relies on user access tokens returned from Google Fit OAuth flow — this flow must include Gmail compose scope and you should harden server-side refresh handling.
- Tavily API key is hard-coded in `summary.ts`; move this to an environment variable before deploying.

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

Use Cloud Secret Manager for all sensitive configuration, rotate keys if they were checked into `backend/.env`.

Next steps & recommendations
—
1. Remove and rotate secrets from `backend/.env` immediately.
2. Decide and document whether `summary.ts` will be deployed as a separate service or merged into `index.ts`. Set `SUMMARY_SERVER_URL` appropriately.
3. Sanitize the system prompt in `index.ts` and remove any instructions that require exposing internal model 'thoughts' or force tool calls without explicit user consent.
4. Move all hard-coded API keys to environment variables.
5. Add robust server-side Gmail token refresh or adopt a service-account based approach if domain delegation is acceptable.

Where to look next
—
- For live agent protocol and system prompts: [AGENTS.md](AGENTS.md)
- For the WebSocket broker and VAPI/Gmail integration: `backend/src/index.ts`
- For summarization: `backend/src/summary.ts` and frontend proxy `frontend/app/api/summarize/route.ts`

If you want, I can also:
- produce a sanitized system prompt patch for `backend/src/index.ts` and a migration checklist to remove checked-in secrets, or
- prepare a `SUMMARY_SERVER_URL` production deployment plan (Cloud Run service + IAM + secrets). Which would you like next?
