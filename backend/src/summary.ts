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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcriptText }],
    });

    const raw = message.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    let summary: string[] = [];
    let actionItems: string[] = [];
    let medications = [
      { name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
    ];

    // Parse plain-text bullets split by ACTION ITEMS:
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

    // ── Firestore write ────────────────────────────────────────────────────
    if (db) {
      try {
        const sessionId = String(Date.now());
        const sessionData: any = {
          sessionId,
          summary,
          actionItems,
          medications,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          method: 'claude',
        };

        if (userId) {
          // Scoped to user: users/{userId}/sessions/{sessionId}
          await db
            .collection('users')
            .doc(userId)
            .collection('sessions')
            .doc(sessionId)
            .set(sessionData);
          console.log(`✅ Session saved to Firestore: users/${userId}/sessions/${sessionId}`);
        } else {
          // Fallback: flat collection (anonymous / no Google auth)
          await db.collection('sessions').doc(sessionId).set(sessionData);
          console.log(`✅ Session saved to Firestore (anonymous): sessions/${sessionId}`);
        }
      } catch (e) {
        console.error('⚠️  Firestore write failed:', e);
      }
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

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!db) {
    return res.status(503).json({ error: 'Firestore not configured' });
  }

  try {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const sessions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        sessionId: data.sessionId || doc.id,
        summary: data.summary || [],
        actionItems: data.actionItems || [],
        medications: data.medications || [],
        // Convert Firestore Timestamp to ISO string for the frontend
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
const TAVILY_API_KEY = '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';

const KEYWORDS_SYSTEM_PROMPT = `You extract search keywords from medical session summaries.
Given a session summary (bullet points and action items), produce 3-5 short search queries
that would find relevant health and medical articles. Focus on the specific conditions, medications, symptoms, and topics mentioned.

Return ONLY a JSON array of query strings, nothing else. No markdown, no backticks.
Example: ["metformin drug interactions","managing type 2 diabetes","blood pressure monitoring tips"]`;

app.post('/articles', async (req, res) => {
  const { summary, actionItems } = req.body || {};
  const bullets = [
    ...(Array.isArray(summary) ? summary : []),
    ...(Array.isArray(actionItems) ? actionItems : []),
  ].filter(Boolean);

  if (bullets.length === 0) {
    return res.status(400).json({ error: 'No summary provided' });
  }

  if (!TAVILY_API_KEY) {
    return res.status(503).json({ error: 'Tavily API key not configured' });
  }

  try {
    // Step 1: Use Claude to extract search keywords from the summary
    const keywordsMsg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      system: KEYWORDS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: bullets.join('\n') }],
    });

    const rawKeywords = keywordsMsg.content
      .filter((b) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();

    let queries: string[];
    try {
      const cleaned = rawKeywords.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      queries = JSON.parse(cleaned);
      if (!Array.isArray(queries)) throw new Error('not an array');
    } catch {
      queries = [bullets[0] + ' health article'];
    }

    console.log(`🔍 Article search queries:`, queries);

    // Step 2: Search Tavily for each query and collect results
    const allResults: any[] = [];
    const seen = new Set<string>();

    for (const query of queries.slice(0, 4)) {
      try {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            max_results: 3,
            include_answer: false,
            search_depth: 'basic',
          }),
        });

        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          for (const r of data.results || []) {
            if (!seen.has(r.url)) {
              seen.add(r.url);
              allResults.push({
                title: r.title || 'Untitled',
                url: r.url,
                snippet: r.content?.slice(0, 200) || '',
                source: new URL(r.url).hostname.replace(/^www\./, ''),
              });
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ Tavily search failed for query: ${query}`, e);
      }
    }

    res.json({ articles: allResults.slice(0, 8), queries });
  } catch (err: any) {
    console.error('Articles endpoint error:', err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

const PORT = 8082;
app.listen(PORT, () => console.log(`📋 Summary server live on ${PORT}`));