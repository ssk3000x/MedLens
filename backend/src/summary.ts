import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

// ── Firebase init ──────────────────────────────────────────────────────────
let db: admin.firestore.Firestore | null = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.some((a) => a?.name === 'summary-server')) {
      const firebaseApp = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        'summary-server'
      );
      db = admin.firestore(firebaseApp);
    } else {
      db = admin.firestore(admin.app('summary-server'));
    }
    console.log('🔥 Firestore connected (summary server)');
  } catch (e) {
    console.error('⚠️  Firestore init failed:', e);
  }
} else {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_JSON not set — Firestore disabled');
}

// ── Anthropic init ─────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY || 'empty_key' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

const SYSTEM_PROMPT = `You summarize medical AI assistant sessions.
You will receive a transcript of a conversation between a user and an AI health assistant.
Return ONLY a JSON array of 3-4 short bullet-point strings summarizing what actually happened in the call.
Each string should be one concise takeaway — what the user reported, what the assistant advised, etc.
Do NOT invent anything not explicitly present in the transcript.
Do NOT mention medications unless the transcript explicitly discusses them.
If the transcript is very short or nearly empty, return fewer bullets.
Example output: ["User reported persistent cough for 2 weeks","Assistant suggested monitoring symptoms","No medications discussed"]
Return ONLY the JSON array, nothing else.`;

app.post('/summarize', async (req, res) => {
  const { transcript } = req.body || {};
  console.log(`📩 Summarize request: ${Array.isArray(transcript) ? transcript.length : 0} messages.`);

  const transcriptText = Array.isArray(transcript) && transcript.length > 0
    ? transcript
        .map((t: any) => {
          let text = String(t.text || '');
          // Strip **Thinking** blocks from agent messages
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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcriptText }],
    });

    const raw = message.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    let summary: string[] = [];
    let medications = [
      { name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
    ];

    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        summary = parsed.map(String);
      } else {
        summary = [raw];
      }
    } catch (e) {
      // If Claude didn't return valid JSON, split by newlines
      summary = raw.split('\n').map(l => l.replace(/^[\-•\d.)\s]+/, '').trim()).filter(Boolean);
      if (summary.length === 0) summary = [raw];
    }

    // ── Firestore write ────────────────────────────────────────────────────
    if (db) {
      try {
        const sessionId = String(Date.now());
        await db.collection('sessions').doc(sessionId).set({
          sessionId,
          summary,
          medications,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          method: 'claude',
        });
        console.log(`✅ Session saved to Firestore: ${sessionId}`);
      } catch (e) {
        console.error('⚠️  Firestore write failed:', e);
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    res.json({ summary, medications, method: 'claude' });
  } catch (err: any) {
    res.json({ summary: 'AI failed to summarize.', medications: [], method: 'error' });
  }
});

const PORT = 8082;
app.listen(PORT, () => console.log(`📋 Summary server live on ${PORT}`));