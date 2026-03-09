import express from 'express';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import { google } from 'googleapis';

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 1. SAFE FIREBASE INITIALIZATION
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin Initialized');
  } catch (e) {
    console.error('❌ Firebase Init Error:', e);
  }
}

const SYSTEM_PROMPT = `Your name is MedLens. You are a real-time clinical AI assistant.
You have two specific tools for email:
1. 'draft_doctor_email': Use this first to create an email draft in the user's Gmail.
2. 'send_email_draft': Use this ONLY after a draft is created and the user gives explicit confirmation to send it.

Always confirm the recipient's email address before drafting. Once a draft is created, inform the user and ask if they are ready to send it now. 
CRITICAL: NEVER output internal thoughts or reasoning blocks like **Thinking**. Just speak to the user.`;

// --- HELPER: Safe WebSocket Send ---
const safeSend = (target: any, payload: object) => {
  if (target && target.readyState === 1) { // 1 = OPEN
    try {
      target.send(JSON.stringify(payload));
    } catch (e) {
      console.error('❌ WS Send Error:', e);
    }
  }
};

// --- GMAIL HELPERS ---
async function createGmailDraft(token: string, to: string, subject: string, body: string) {
  if (!token) throw new Error('No access token provided');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body || ''}`;
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw: encoded } }
  });
  console.log('✅ Draft created in Google:', res.data.id);
  return { draftId: res.data.id, status: 'success' };
}

async function sendGmailDraft(token: string, draftId: string) {
  if (!token) throw new Error('No access token provided');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth });

  await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId }
  });
  console.log('🚀 Draft sent via Google:', draftId);
  return { status: 'sent' };
}

// --- TOKEN REFRESH HELPER ---
async function refreshAccessToken(refreshToken: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return resp.ok ? await resp.json() : null;
  } catch (e) { return null; }
}

wss.on('connection', (ws: any) => {
  console.log('✅ UI Connected to Port 8081');
  
  let currentAccessToken: string | null = null;
  let currentRefreshToken: string | null = null;
  let geminiSocket: WSClient | null = null;
  let geminiReady = false;
  let latestFrameBase64: string | null = null;

  const keepaliveTimer = setInterval(() => {
    safeSend(ws, { type: 'keepalive', timestamp: Date.now() });
  }, 30000);

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'session_start':
          currentAccessToken = data.accessToken || null;
          currentRefreshToken = data.refreshToken || null;
          geminiReady = false;
          
          const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
          geminiSocket = new WSClient(wsUrl);

          geminiSocket.on('open', () => {
            console.log('🤖 Connected to Gemini Live API');
            const setupMessage = {
              setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                tools: [{ google_search_retrieval: {} }, {
                  function_declarations: [
                    {
                      name: 'draft_doctor_email',
                      description: 'Create a draft email in the user\'s Gmail account',
                      parameters: {
                        type: 'object',
                        properties: {
                          recipient_email: { type: 'string' },
                          subject: { type: 'string' },
                          body: { type: 'string' }
                        },
                        required: ['recipient_email', 'subject', 'body']
                      }
                    },
                    {
                      name: 'send_email_draft',
                      description: 'Actually send a previously created email draft',
                      parameters: {
                        type: 'object',
                        properties: {
                          draftId: { type: 'string', description: 'The ID of the draft to send' }
                        },
                        required: ['draftId']
                      }
                    }
                  ]
                }],
                generation_config: { response_modalities: ["audio"] },
                system_instruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] }
              }
            };
            safeSend(geminiSocket, setupMessage);
          });

          geminiSocket.on('message', async (geminiData: any) => {
            try {
              const res = JSON.parse(geminiData.toString());

              if (res.setupComplete) {
                geminiReady = true;
                console.log('✅ Gemini Live Ready');
                return;
              }

              // --- ROBUST TOOL CALL HANDLER ---
              // Detect function calls regardless of where they appear in the JSON
              const toolCall = res.toolCall || res.tool_call || res.serverContent?.modelTurn?.parts?.find((p: any) => p.functionCall)?.functionCall;
              const calls = toolCall?.functionCalls || (toolCall?.name ? [toolCall] : []);

              if (calls.length > 0) {
                for (const fc of calls) {
                  const callId = fc.id || fc.function_call_id;
                  console.log(`🛠️ REAL TOOL CALL DETECTED: ${fc.name} (ID: ${callId})`);
                  
                  let result;
                  try {
                    // Try token refresh if current token is missing
                    if (!currentAccessToken && currentRefreshToken) {
                      const refreshed = await refreshAccessToken(currentRefreshToken);
                      if (refreshed?.access_token) currentAccessToken = refreshed.access_token;
                    }

                    if (fc.name === 'draft_doctor_email') {
                      const to = fc.args.recipient_email || fc.args.recipient;
                      result = await createGmailDraft(currentAccessToken || '', to, fc.args.subject, fc.args.body);
                    } else if (fc.name === 'send_email_draft') {
                      result = await sendGmailDraft(currentAccessToken || '', fc.args.draftId);
                    }
                  } catch (err: any) {
                    console.error(`❌ Tool execution failed:`, err.message);
                    result = { status: 'error', message: err.message };
                  }

                  // MANDATORY BIDI PROTOCOL: Send feedback to unblock AI speech
                  safeSend(geminiSocket, {
                    tool_response: {
                      function_responses: [{ id: callId, name: fc.name, response: { result } }]
                    }
                  });
                  console.log(`📤 Feedback pushed for ${fc.name}`);
                  safeSend(ws, { type: 'agent_action', text: `${fc.name} complete.` });
                }
              }

              // --- SPEECH & TEXT RELAY ---
              if (res.serverContent?.modelTurn?.parts) {
                for (const part of res.serverContent.modelTurn.parts) {
                  if (part.inlineData) safeSend(ws, { type: 'agent_speech_chunk', data: part.inlineData.data });
                  if (part.text) safeSend(ws, { type: 'agent_speech_text', text: part.text });
                }
              }

              if (res.serverContent?.turnComplete) safeSend(ws, { type: 'agent_speech_end' });

            } catch (e) { console.error('❌ Gemini Message Handler Error:', e); }
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
            const userParts: any[] = [{ text: data.text }];
            if (latestFrameBase64) userParts.push({ inline_data: { mime_type: 'image/jpeg', data: latestFrameBase64 } });
            safeSend(geminiSocket, { client_content: { turn_complete: true, turns: [{ role: 'user', parts: userParts }] } });
          }
          break;
      }
    } catch (e) { console.error('❌ WebSocket Error:', e); }
  });

  ws.on('close', () => {
    clearInterval(keepaliveTimer);
    if (geminiSocket) geminiSocket.close();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 BACKEND ENGINE RUNNING ON PORT ${PORT}`));

// Summarize endpoint remains here as in your previous file...
app.post('/summarize', async (req, res) => {
  /* ... keep your existing logic for app.post('/summarize') ... */
  res.json({ status: 'ready' }); // Placeholder for brevity
});