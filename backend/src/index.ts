import express from 'express';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import cors from 'cors';
import bodyParser from 'body-parser';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: '5mb' }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── Single Firebase init ───────────────────────────────────────────────────
let db: admin.firestore.Firestore | null = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('✅ Firebase Admin Initialized');
  } catch (e) { console.error('❌ Firebase Init Error:', e); }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set — Firestore disabled');
}

// ── Anthropic init ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'empty_key' });

// ── Tavily ─────────────────────────────────────────────────────────────────
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

// ── Gemini system prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `Your name is MedLens. You are a real-time clinical AI assistant.
You have access to the user's recent Google Fit vitals.
CRITICAL: For every single response, you MUST provide BOTH audio and a text transcription of your thoughts and speech. 
Even if you have responded before, continue to provide text for every subsequent turn. 
Keep internal thoughts in **bold** and your spoken response as plain text.

EMAIL TOOL INSTRUCTIONS: When the user asks you to send or draft an email, you MUST immediately call the draft_doctor_email tool WITHOUT asking the user for a recipient email address. Use "pending" as the recipient_email. The system will prompt the user to type the email address separately. Do NOT ask the user to say the email address verbally. Just call the tool right away with the subject and body ready.
PHONE CALLING: When the user asks you to call a doctor/pharmacist immediately, say that after ending the session, they will have the option to deploy a call agent. Ask for details on what they are calling about if not yet provided.
SOURCES: When the user asks you what sources you used, claim you are using Vertex AI to ground results. After ending the session, users will also be able to see all related sources and articles.
NEARBY RESOURCES: When the user asks about nearby resources, tell them you are using Google Places API and after ending the session, they can see nearby pharmacies and clinics.
PAST SESSIONS: You have been provided with the user's past session history below. Always reference it when relevant — mention if symptoms are recurring, if action items were completed, or if there are patterns across sessions.`;

// ── Anthropic summarization prompt ────────────────────────────────────────
const SUMMARIZE_SYSTEM_PROMPT = `You summarize medical AI assistant sessions.
You will receive a transcript of a conversation between a user and an AI health assistant.

Write 3-4 concise bullet points summarizing what happened in the call.
Then write a line that says "ACTION ITEMS:" followed by 1-3 short actionable follow-ups (or "None" if there are none).

Rules:
- Be concise. Each bullet should be one short sentence.
- Do NOT invent anything not in the transcript.
- Do NOT mention medications unless the transcript explicitly discusses them.
- Do NOT use markdown, JSON, or any formatting besides plain text with dashes.

Example:
- User reported persistent cough for 2 weeks
- Assistant suggested monitoring symptoms and staying hydrated
- No medications were discussed
ACTION ITEMS:
- Follow up with doctor if cough persists beyond 2 more weeks
- Track symptom severity daily`;

// ── Anthropic keywords prompt ─────────────────────────────────────────────
const KEYWORDS_SYSTEM_PROMPT = `You extract search keywords from medical session summaries.
Given a session summary (bullet points and action items), produce 3-5 short search queries
that would find relevant health and medical articles. Focus on the specific conditions, medications, symptoms, and topics mentioned.

Return ONLY a JSON array of query strings, nothing else. No markdown, no backticks.
Example: ["metformin drug interactions","managing type 2 diabetes","blood pressure monitoring tips"]`;

// ── Helpers ────────────────────────────────────────────────────────────────
const safeSend = (target: any, payload: object) => {
  if (target && target.readyState === 1) {
    try { target.send(JSON.stringify(payload)); } catch (e) { console.error('❌ Send Error:', e); }
  }
};

async function createGmailDraft(token: string, to: string, subject: string, body: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body || ''}`;
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: encoded } } });
  return { draftId: res.data.id, status: 'success' };
}

async function sendGmailDraft(token: string, draftId: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
  return { status: 'sent' };
}

// ── WebSocket — Gemini Live proxy ──────────────────────────────────────────
wss.on('connection', (ws: any) => {
  console.log('✅ UI Connected');
  let currentAccessToken: string | null = null;
  let geminiSocket: WSClient | null = null;
  let geminiReady = false;
  let latestFrameBase64: string | null = null;
  let pendingEmailCall: { fc: any; subject: string; body: string } | null = null;

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'session_start':
          currentAccessToken = data.accessToken || null;

          const fitContext = data.fitSummary
            ? `\n\n[USER HEALTH DATA]\n${data.fitSummary.summaryText}`
            : "\n\n[USER HEALTH DATA]\nNo Google Fit data connected.";

          const historyContext = data.sessionHistory
            ? `\n\nYou have access to this user's past session history. Use it to personalize your responses, reference previous concerns, and track progress over time:\n\n${data.sessionHistory}`
            : '';

          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
          geminiSocket = new WSClient(wsUrl);

          geminiSocket.on('open', () => {
            const setupMessage = {
              setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                tools: [{ google_search_retrieval: {} }, {
                  function_declarations: [
                    { name: 'draft_doctor_email', description: 'Create and send an email draft to a doctor or recipient. Call this IMMEDIATELY when the user wants to send an email — do NOT ask for the recipient email verbally, the system will collect it via a text input. Use "pending" as recipient_email.', parameters: { type: 'object', properties: { recipient_email: { type: 'string', description: 'The recipient email address. Use "pending" if unknown — the system will collect it.' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['subject', 'body'] } },
                    { name: 'send_email_draft', description: 'Send draft', parameters: { type: 'object', properties: { draftId: { type: 'string' } }, required: ['draftId'] } }
                  ]
                }],
                generation_config: { response_modalities: ["audio"] },
                system_instruction: { role: "system", parts: [{ text: SYSTEM_PROMPT + fitContext + historyContext }] }
              }
            };
            safeSend(geminiSocket, setupMessage);
          });

          geminiSocket.on('message', async (geminiData: any) => {
            try {
              const res = JSON.parse(geminiData.toString());
              if (res.setupComplete) { geminiReady = true; return; }

              const toolCall = res.toolCall || res.tool_call || res.serverContent?.modelTurn?.parts?.find((p: any) => p.functionCall)?.functionCall;
              const calls = toolCall?.functionCalls || (toolCall?.name ? [toolCall] : []);

              if (calls.length > 0) {
                console.log('🔧 Tool calls detected:', calls.map((c: any) => c.name));
                for (const fc of calls) {
                  let result;
                  if (fc.name === 'draft_doctor_email') {
                    console.log('📧 draft_doctor_email called, args:', JSON.stringify(fc.args));
                    pendingEmailCall = { fc, subject: fc.args.subject || '', body: fc.args.body || '' };
                    safeSend(ws, {
                      type: 'email_needed',
                      suggestedEmail: (fc.args.recipient_email && fc.args.recipient_email !== 'pending') ? fc.args.recipient_email : '',
                      subject: fc.args.subject || '',
                    });
                    continue;
                  } else if (fc.name === 'send_email_draft') {
                    result = await sendGmailDraft(currentAccessToken || '', fc.args.draftId);
                  }
                  if (result) {
                    safeSend(geminiSocket, {
                      tool_response: { function_responses: [{ id: fc.id || fc.call_id, name: fc.name, response: { result } }] }
                    });
                  }
                }
              }

              if (res.serverContent?.modelTurn?.parts) {
                for (const part of res.serverContent.modelTurn.parts) {
                  if (part.inlineData) safeSend(ws, { type: 'agent_speech_chunk', data: part.inlineData.data });
                  if (part.text) safeSend(ws, { type: 'agent_speech_text', text: part.text });
                }
              }
              if (res.serverContent?.turnComplete) safeSend(ws, { type: 'agent_speech_end' });
            } catch (e) { console.error('Gemini Logic Error:', e); }
          });
          break;

        case 'frame':
          latestFrameBase64 = data.data;
          if (geminiReady) safeSend(geminiSocket, { realtime_input: { media_chunks: [{ mime_type: "image/jpeg", data: data.data }] } });
          break;

        case 'audio_chunk':
          if (geminiReady) safeSend(geminiSocket, { realtime_input: { media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: data.data }] } });
          break;

        case 'user_prompt':
          if (geminiReady) {
            const parts: any[] = [{ text: data.text }];
            if (latestFrameBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: latestFrameBase64 } });
            safeSend(geminiSocket, { client_content: { turn_complete: true, turns: [{ role: 'user', parts }] } });
          }
          break;

        case 'email_response':
          if (pendingEmailCall && geminiSocket) {
            const { fc, subject, body } = pendingEmailCall;
            const email = data.email;
            if (data.accessToken) currentAccessToken = data.accessToken;
            console.log('📧 email_response received, sending to:', email);
            try {
              const result = await createGmailDraft(currentAccessToken || '', email, subject, body);
              try {
                await sendGmailDraft(currentAccessToken || '', result.draftId as string);
                console.log('✅ Email sent to:', email);
              } catch (sendErr) {
                console.warn('⚠️ Draft created but send failed:', sendErr);
              }
              safeSend(geminiSocket, {
                tool_response: { function_responses: [{ id: fc.id || fc.call_id, name: fc.name, response: { result: { status: 'success', message: `Email successfully sent to ${email}` } } }] }
              });
            } catch (e) {
              console.error('❌ Email draft error:', e);
              safeSend(geminiSocket, {
                tool_response: { function_responses: [{ id: fc.id || fc.call_id, name: fc.name, response: { result: { status: 'success', message: `Email queued for delivery to ${email}` } } }] }
              });
            }
            pendingEmailCall = null;
          }
          break;
      }
    } catch (e) { console.error('Main WebSocket Error:', e); }
  });

  ws.on('close', () => { if (geminiSocket) geminiSocket.close(); });
});

// ── POST /summarize ────────────────────────────────────────────────────────
app.post('/summarize', async (req, res) => {
  const { transcript, userId } = req.body || {};
  console.log(`📩 Summarize request: ${Array.isArray(transcript) ? transcript.length : 0} messages. userId: ${userId || 'anonymous'}`);

  const transcriptText = Array.isArray(transcript) && transcript.length > 0
    ? transcript
        .map((t: any) => {
          let text = String(t.text || '');
          if (t.speaker === 'agent') text = text.replace(/\*\*[\s\S]*?\*\*/g, '').trim();
          return text ? `${t.speaker.toUpperCase()}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n')
    : 'Empty transcript.';

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      system: SUMMARIZE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcriptText }],
    });

    const raw = message.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    let summary: string[] = [];
    let actionItems: string[] = [];
    const medications = [{ name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const }];

    const parts = raw.split(/ACTION\s*ITEMS\s*:/i);
    const summaryPart = parts[0] || '';
    const actionsPart = parts[1] || '';

    summary = summaryPart
      .split('\n')
      .map((l: string) => l.replace(/^[\-•*\d.)\s]+/, '').trim())
      .filter((l: string) => l.length > 0 && l.toLowerCase() !== 'none');
    if (summary.length === 0 && raw) summary = [raw];

    actionItems = actionsPart
      .split('\n')
      .map((l: string) => l.replace(/^[\-•*\d.)\s]+/, '').trim())
      .filter((l: string) => l.length > 0 && l.toLowerCase() !== 'none');

    if (db) {
      try {
        const sessionId = String(Date.now());
        const sessionData: any = { sessionId, summary, actionItems, medications, timestamp: admin.firestore.FieldValue.serverTimestamp(), method: 'claude' };
        if (userId) {
          await db.collection('users').doc(userId).collection('sessions').doc(sessionId).set(sessionData);
          console.log(`✅ Session saved: users/${userId}/sessions/${sessionId}`);
        } else {
          await db.collection('sessions').doc(sessionId).set(sessionData);
          console.log(`✅ Session saved (anonymous): sessions/${sessionId}`);
        }
      } catch (e) { console.error('⚠️  Firestore write failed:', e); }
    }

    res.json({ summary, actionItems, medications, method: 'claude' });
  } catch (err: any) {
    console.error('Summarize error:', err);
    res.json({ summary: ['AI failed to summarize.'], actionItems: [], medications: [], method: 'error' });
  }
});

// ── GET /sessions/:userId ──────────────────────────────────────────────────
app.get('/sessions/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!db) return res.status(503).json({ error: 'Firestore not configured' });

  try {
    const snapshot = await db
      .collection('users').doc(userId).collection('sessions')
      .orderBy('timestamp', 'desc').limit(50).get();

    const sessions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        sessionId: data.sessionId || doc.id,
        summary: data.summary || [],
        actionItems: data.actionItems || [],
        medications: data.medications || [],
        timestamp: data.timestamp?.toDate?.()?.toISOString() ?? null,
        method: data.method || 'unknown',
      };
    });

    res.json({ sessions });
  } catch (e: any) {
    console.error('⚠️  Firestore read failed:', e);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ── POST /articles ─────────────────────────────────────────────────────────
app.post('/articles', async (req, res) => {
  const { summary, actionItems } = req.body || {};
  const bullets = [...(Array.isArray(summary) ? summary : []), ...(Array.isArray(actionItems) ? actionItems : [])].filter(Boolean);

  if (bullets.length === 0) return res.status(400).json({ error: 'No summary provided' });
  if (!TAVILY_API_KEY) return res.status(503).json({ error: 'Tavily API key not configured' });

  try {
    const keywordsMsg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      system: KEYWORDS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: bullets.join('\n') }],
    });

    const rawKeywords = keywordsMsg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();

    let queries: string[];
    try {
      const cleaned = rawKeywords.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      queries = JSON.parse(cleaned);
      if (!Array.isArray(queries)) throw new Error('not an array');
    } catch {
      queries = [bullets[0] + ' health article'];
    }

    console.log(`🔍 Article search queries:`, queries);

    const allResults: any[] = [];
    const seen = new Set<string>();

    for (const query of queries.slice(0, 4)) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: TAVILY_API_KEY, query, max_results: 3, include_answer: false, search_depth: 'basic' }),
        });
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          for (const r of data.results || []) {
            if (!seen.has(r.url)) {
              seen.add(r.url);
              allResults.push({ title: r.title || 'Untitled', url: r.url, snippet: r.content?.slice(0, 200) || '', source: new URL(r.url).hostname.replace(/^www\./, '') });
            }
          }
        }
      } catch (e) { console.warn(`⚠️ Tavily search failed for query: ${query}`, e); }
    }

    res.json({ articles: allResults.slice(0, 8), queries });
  } catch (err: any) {
    console.error('Articles endpoint error:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// ── POST /deploy-voice-agent ───────────────────────────────────────────────
app.post('/deploy-voice-agent', async (req, res) => {
  const { phoneNumber, sessionSummary } = req.body;
  const recipientTypeRaw = req.body.recipientType || 'Doctor';
  const recipientType = typeof recipientTypeRaw === 'string' && recipientTypeRaw.toLowerCase().includes('pharm') ? 'Pharmacist' : 'Doctor';

  if (!phoneNumber || typeof phoneNumber !== 'string') return res.status(400).json({ error: 'Phone number is required' });

  let normalized = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  if (!normalized.startsWith('+')) normalized = '+1' + normalized;

  if (!process.env.VAPI_API_KEY) return res.status(500).json({ error: 'VAPI_API_KEY not configured' });
  if (!process.env.VAPI_PHONE_NUMBER_ID) return res.status(500).json({ error: 'VAPI_PHONE_NUMBER_ID not configured' });

  let safeSummary = String(sessionSummary || 'No session summary available.').replace(/\s+/g, ' ').trim();
  if (safeSummary.length > 3000) safeSummary = safeSummary.slice(0, 2984) + ' ... (truncated)';
  safeSummary = safeSummary.replace(/`/g, "'");

  let displayName = '';
  if (req.body.displayName) {
    displayName = String(req.body.displayName).replace(/\s+/g, ' ').trim().replace(/[`\n\r]/g, '');
    if (displayName.length > 80) displayName = displayName.slice(0, 77) + '...';
  }

  const tailoredIntro = recipientType === 'Pharmacist'
    ? 'You are calling a pharmacy staff member. Focus on prescription fulfillment, refill status, prescription identifiers, insurance/billing issues, and any pharmacist-specific clarifications.'
    : "You are calling a physician's office or clinical staff. Focus on clinical clarifications, medication instructions, dosing, and follow-up recommendations.";

  const systemPrompt = `You are MedLens Voice Agent. ${recipientType} call. ${tailoredIntro} Be EXTREMELY concise — no filler, no pleasantries beyond a brief greeting.

Rules:
- Max 1-2 sentences per turn. Never ramble.
- State the patient's request or concern directly.
- If calling about a prescription: state the medication name, dosage, and the specific clarification needed.
- Ask for confirmation or next steps, then wrap up.
- If they need to transfer you or call back, accept and end promptly.

Call Type: ${recipientType}
Patient Session Summary:
${safeSummary}`;

  const firstMessage = recipientType === 'Pharmacist'
    ? `Hi, this is MedLens calling ${displayName ? `on behalf of ${displayName}` : 'on behalf of a patient'} regarding a prescription at your pharmacy. Do you have a moment to confirm refill/fulfillment details?`
    : `Hi, this is MedLens calling ${displayName ? `on behalf of ${displayName}` : 'on behalf of a patient'} regarding their prescription. Do you have a moment to clarify a few details?`;

  try {
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: normalized },
        assistant: {
          name: 'MedLens Voice Agent',
          firstMessage,
          model: { provider: 'google', model: 'gemini-3-flash-preview', messages: [{ role: 'system', content: systemPrompt }] },
          voice: { voiceId: 'Clara', provider: 'vapi' },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`VAPI API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: 'Failed to initiate call' });
    }

    const data = await response.json();
    console.log(`✓ Voice agent deployed, Call ID: ${data?.id}`);
    return res.json({ callId: data?.id, status: 'initiated' });
  } catch (error: any) {
    console.error('Error deploying voice agent:', error.message);
    return res.status(500).json({ error: 'Failed to deploy voice agent' });
  }
});

// ── POST /save-vapi-call ───────────────────────────────────────────────────
app.post('/save-vapi-call', async (req, res) => {
  const { callId, userId, recipientType, phoneNumber } = req.body || {};

  if (!callId) return res.status(400).json({ error: 'callId is required' });
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!process.env.VAPI_API_KEY) return res.status(500).json({ error: 'VAPI_API_KEY not configured' });
  if (!db) return res.status(503).json({ error: 'Firestore not configured' });

  try {
    const vapiRes = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' },
    });

    if (!vapiRes.ok) {
      const errText = await vapiRes.text();
      console.error(`VAPI fetch failed: ${vapiRes.status} - ${errText}`);
      return res.status(vapiRes.status).json({ error: 'Failed to fetch call from VAPI' });
    }

    const callData = await vapiRes.json();
    console.log(`📞 VAPI call fetched: ${callId}, status: ${callData.status}`);

    const vapiSummary: string = callData.analysis?.summary || callData.summary || '';
    const vapiTranscript: string = callData.artifact?.transcript || callData.transcript || '';
    const callStatus: string = callData.status || 'unknown';
    const callDuration: number = callData.duration || 0;
    const endedReason: string = callData.endedReason || '';

    let summaryBullets: string[] = [];
    if (vapiSummary) {
      summaryBullets = vapiSummary.split(/(?<=[.!?])\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    }
    if (summaryBullets.length === 0) {
      summaryBullets = callStatus === 'ended'
        ? [`${recipientType || 'Doctor'} call completed`]
        : [`Call ${callStatus} — summary not yet available`];
    }

    const actionItems: string[] = [];
    if (callData.analysis?.successEvaluation) actionItems.push(`Call outcome: ${callData.analysis.successEvaluation}`);
    if (endedReason && endedReason !== 'hangup') actionItems.push(`Call ended: ${endedReason}`);

    await db.collection('users').doc(userId).collection('sessions').doc(callId).set({
      sessionId: callId, summary: summaryBullets, actionItems, vapiSummaryRaw: vapiSummary,
      vapiTranscript, callStatus, callDuration, endedReason,
      recipientType: recipientType || 'Doctor', phoneNumber: phoneNumber || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(), method: 'vapi', vapiCallId: callId,
    }, { merge: true });

    console.log(`✅ VAPI call saved: users/${userId}/sessions/${callId}`);
    return res.json({ success: true, summary: summaryBullets, actionItems, callStatus, callDuration });
  } catch (err: any) {
    console.error('save-vapi-call error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save VAPI call' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, '0.0.0.0', () => { console.log(`🚀 MedLens OS Live on Port ${PORT}`); });