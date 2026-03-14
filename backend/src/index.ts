import express from 'express';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 1. FIREBASE INITIALIZATION
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin Initialized');
  } catch (e) { console.error('❌ Firebase Init Error:', e); }
}

const SYSTEM_PROMPT = `Your name is MedLens. You are a real-time clinical AI assistant.
You have access to the user's recent Google Fit vitals. Use this to personalize your medical safety advice.
CRITICAL: NEVER output internal thoughts like **Thinking**. Just speak naturally.

EMAIL TOOLS:
1. 'draft_doctor_email': Create a draft in Gmail.
2. 'send_email_draft': ONLY call this after a draft is created and user says "send it".`;

const safeSend = (target: any, payload: object) => {
  if (target && target.readyState === 1) {
    try { target.send(JSON.stringify(payload)); } catch (e) { console.error('❌ Send Error:', e); }
  }
};

// --- GMAIL HELPERS ---
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
  let geminiSocket: WSClient | null = null;
  let geminiReady = false;
  let latestFrameBase64: string | null = null;

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'session_start':
          currentAccessToken = data.accessToken || null;
          
          // --- HEALTH CONTEXT INJECTION ---
          const fitContext = data.fitSummary 
            ? `\n\n[USER HEALTH DATA]\n${data.fitSummary.summaryText}\nRaw: ${JSON.stringify(data.fitSummary.summaryJson)}`
            : "\n\n[USER HEALTH DATA]\nNo Google Fit data connected for this user.";

          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
          geminiSocket = new WSClient(wsUrl);

          geminiSocket.on('open', () => {
            const setupMessage = {
              setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                tools: [{ google_search_retrieval: {} }, {
                  function_declarations: [
                    {
                      name: 'draft_doctor_email',
                      description: 'Create a draft email',
                      parameters: {
                        type: 'object',
                        properties: { recipient_email: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
                        required: ['recipient_email', 'subject', 'body']
                      }
                    },
                    {
                      name: 'send_email_draft',
                      description: 'Send a draft',
                      parameters: {
                        type: 'object',
                        properties: { draftId: { type: 'string' } },
                        required: ['draftId']
                      }
                    }
                  ]
                }],
                generation_config: { response_modalities: ["audio"] },
                system_instruction: {
                  role: "system",
                  parts: [{ text: SYSTEM_PROMPT + fitContext }] // <--- INJECTED HERE
                }
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
                for (const fc of calls) {
                  let result;
                  if (fc.name === 'draft_doctor_email') {
                    result = await createGmailDraft(currentAccessToken || '', fc.args.recipient_email, fc.args.subject, fc.args.body);
                  } else if (fc.name === 'send_email_draft') {
                    result = await sendGmailDraft(currentAccessToken || '', fc.args.draftId);
                  }
                  safeSend(geminiSocket, {
                    tool_response: { function_responses: [{ id: fc.id || fc.call_id, name: fc.name, response: { result } }] }
                  });
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
      }
    } catch (e) { console.error('Main WebSocket Error:', e); }
  });

  ws.on('close', () => { if (geminiSocket) geminiSocket.close(); });
});

// Cloud Run expects 8080, Local expects 8081. This handles both.
const PORT = Number(process.env.PORT) || 8081;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MedLens OS Live on Port ${PORT}`);
});