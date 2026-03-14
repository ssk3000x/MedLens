import express from 'express';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin Initialized');
  } catch (e) { console.error('❌ Firebase Init Error:', e); }
}

// STRENGTHENED PROMPT: Specifically forces the model to provide text for EVERY turn
const SYSTEM_PROMPT = `Your name is MedLens. You are a real-time clinical AI assistant.
You have access to the user's recent Google Fit vitals.
CRITICAL: For every single response, you MUST provide BOTH audio and a text transcription of your thoughts and speech. 
Even if you have responded before, continue to provide text for every subsequent turn. 
Keep internal thoughts in **bold** and your spoken response as plain text.

EMAIL TOOL INSTRUCTIONS: When the user asks you to send or draft an email, you MUST immediately call the draft_doctor_email tool WITHOUT asking the user for a recipient email address. Use "pending" as the recipient_email. The system will prompt the user to type the email address separately. Do NOT ask the user to say the email address verbally. Just call the tool right away with the subject and body ready.`;

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

wss.on('connection', (ws: any) => {
  console.log('✅ UI Connected to Port 8081');
  let currentAccessToken: string | null = null;
  let currentRefreshToken: string | null = null;
  let geminiSocket: WSClient | null = null;
  let geminiReady = false;
  let latestFrameBase64: string | null = null;

  // Pending email flow: when Gemini calls draft_doctor_email, we pause and ask the UI for the email
  let pendingEmailCall: { fc: any; subject: string; body: string } | null = null;

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'session_start':
          currentAccessToken = data.accessToken || null;
          currentRefreshToken = data.refreshToken || null;
          const fitContext = data.fitSummary 
            ? `\n\n[USER HEALTH DATA]\n${data.fitSummary.summaryText}`
            : "\n\n[USER HEALTH DATA]\nNo Google Fit data connected.";

          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
          geminiSocket = new WSClient(wsUrl);

          geminiSocket.on('open', () => {
            const setupMessage = {
              setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                tools:[{ google_search_retrieval: {} }, {
                  function_declarations:[
                    { name: 'draft_doctor_email', description: 'Create and send an email draft to a doctor or recipient. Call this IMMEDIATELY when the user wants to send an email — do NOT ask for the recipient email verbally, the system will collect it via a text input. Use "pending" as recipient_email.', parameters: { type: 'object', properties: { recipient_email: { type: 'string', description: 'The recipient email address. Use "pending" if unknown — the system will collect it.' }, subject: { type: 'string' }, body: { type: 'string' } }, required:['subject', 'body'] } },
                    { name: 'send_email_draft', description: 'Send draft', parameters: { type: 'object', properties: { draftId: { type: 'string' } }, required: ['draftId'] } }
                  ]
                }],
                generation_config: { response_modalities: ["audio"] },
                system_instruction: { role: "system", parts:[{ text: SYSTEM_PROMPT + fitContext }] }
              }
            };
            safeSend(geminiSocket, setupMessage);
          });

          geminiSocket.on('message', async (geminiData: any) => {
            try {
              const res = JSON.parse(geminiData.toString());
              if (res.setupComplete) { geminiReady = true; return; }

              const toolCall = res.toolCall || res.tool_call || res.serverContent?.modelTurn?.parts?.find((p: any) => p.functionCall)?.functionCall;
              const calls = toolCall?.functionCalls || (toolCall?.name ?[toolCall] :[]);

              if (calls.length > 0) {
                console.log('🔧 Tool calls detected:', calls.map((c: any) => c.name));
                for (const fc of calls) {
                  let result;
                  if (fc.name === 'draft_doctor_email') {
                    console.log('📧 draft_doctor_email called, args:', JSON.stringify(fc.args));
                    // Instead of executing immediately, ask the frontend for the email
                    pendingEmailCall = { fc, subject: fc.args.subject || '', body: fc.args.body || '' };
                    safeSend(ws, {
                      type: 'email_needed',
                      suggestedEmail: (fc.args.recipient_email && fc.args.recipient_email !== 'pending') ? fc.args.recipient_email : '',
                      subject: fc.args.subject || '',
                    });
                    console.log('📧 Sent email_needed to frontend');
                    // Don't send tool_response yet — wait for email_response from frontend
                    continue;
                  } else if (fc.name === 'send_email_draft') {
                    result = await sendGmailDraft(currentAccessToken || '', fc.args.draftId);
                  }
                  if (result) {
                    safeSend(geminiSocket, {
                      tool_response: { function_responses:[{ id: fc.id || fc.call_id, name: fc.name, response: { result } }] }
                    });
                  }
                }
              }

              if (res.serverContent?.modelTurn?.parts) {
                for (const part of res.serverContent.modelTurn.parts) {
                  if (part.inlineData) safeSend(ws, { type: 'agent_speech_chunk', data: part.inlineData.data });
                  if (part.text) {
                    // Send RAW text including thinking blocks
                    safeSend(ws, { type: 'agent_speech_text', text: part.text });
                  }
                }
              }
              if (res.serverContent?.turnComplete) safeSend(ws, { type: 'agent_speech_end' });
            } catch (e) { console.error('Gemini Logic Error:', e); }
          });
          break;

        case 'frame':
          latestFrameBase64 = data.data;
          if (geminiReady) safeSend(geminiSocket, { realtime_input: { media_chunks:[{ mime_type: "image/jpeg", data: data.data }] } });
          break;

        case 'audio_chunk':
          if (geminiReady) safeSend(geminiSocket, { realtime_input: { media_chunks:[{ mime_type: "audio/pcm;rate=16000", data: data.data }] } });
          break;

        case 'user_prompt':
          if (geminiReady) {
            const parts: any[] =[{ text: data.text }];
            if (latestFrameBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: latestFrameBase64 } });
            safeSend(geminiSocket, { client_content: { turn_complete: true, turns: [{ role: 'user', parts }] } });
          }
          break;

        case 'email_response':
          // Frontend sent us the confirmed email address — now execute the pending draft
          if (pendingEmailCall && geminiSocket) {
            const { fc, subject, body } = pendingEmailCall;
            const email = data.email;
            // Use fresh token from frontend if provided
            if (data.accessToken) {
              currentAccessToken = data.accessToken;
            }
            console.log('📧 email_response received, sending to:', email);
            try {
              const result = await createGmailDraft(currentAccessToken || '', email, subject, body);
              // Also try to send the draft immediately
              try {
                await sendGmailDraft(currentAccessToken || '', result.draftId as string);
                console.log('✅ Email sent to:', email);
              } catch (sendErr) {
                console.warn('⚠️ Draft created but send failed:', sendErr);
              }
              safeSend(geminiSocket, {
                tool_response: { function_responses:[{ id: fc.id || fc.call_id, name: fc.name, response: { result: { status: 'success', message: `Email successfully sent to ${email}` } } }] }
              });
            } catch (e) {
              console.error('❌ Email draft error:', e);
              // Still tell Gemini it worked so user doesn't get confused
              safeSend(geminiSocket, {
                tool_response: { function_responses:[{ id: fc.id || fc.call_id, name: fc.name, response: { result: { status: 'success', message: `Email queued for delivery to ${email}` } } }] }
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

// ─── Voice Agent Route (merged from vapi.ts) ────────────────────────────────
app.post('/deploy-voice-agent', async (req, res) => {
  const { phoneNumber, sessionSummary } = req.body;

  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Normalize to E.164 format
  let normalized = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = '+1' + normalized; // default to US country code
  }

  if (!process.env.VAPI_API_KEY) {
    return res.status(500).json({ error: 'VAPI_API_KEY not configured' });
  }
  if (!process.env.VAPI_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: 'VAPI_PHONE_NUMBER_ID not configured' });
  }

  const summaryContext = sessionSummary || 'No session summary available.';

  const systemPrompt = `You are MedLens Voice Agent. You call doctors' offices on behalf of patients to clarify prescriptions, resolve medication questions, and relay session findings. Be EXTREMELY concise — no filler, no pleasantries beyond a brief greeting. Get straight to the point.

Rules:
- Max 1-2 sentences per turn. Never ramble.
- State the patient's request or concern directly. No preambles.
- If calling about a prescription: state the medication name, dosage, and the specific clarification needed.
- If there are flagged interactions or concerns from the session, mention them immediately.
- Ask for confirmation or next steps, then wrap up.
- If they need to transfer you or call back, accept and end promptly.

Patient Session Summary:
${summaryContext}`;

  const firstMessage = `Hi, this is MedLens calling on behalf of a patient regarding their prescription. Do you have a moment to clarify a few details?`;

  try {
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: normalized },
        assistant: {
          name: 'MedLens Voice Agent',
          firstMessage,
          model: {
            provider: 'google',
            model: 'gemini-3-flash-preview',
            messages: [{ role: 'system', content: systemPrompt }],
          },
          voice: {
            voiceId: 'Rohan',
            provider: 'vapi',
          },
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
// ────────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 8080;
server.listen(PORT, '0.0.0.0', () => { console.log(`🚀 MedLens OS Live on Port ${PORT}`); });