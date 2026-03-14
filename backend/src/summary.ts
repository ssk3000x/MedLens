import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = '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';
if (!ANTHROPIC_API_KEY) console.warn('⚠️ ANTHROPIC_API_KEY not set in environment (read from .env)');

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const SYSTEM_PROMPT = `You are a concise clinical session summarizer. You MUST ALWAYS return valid JSON — no exceptions, no refusals, no commentary.

Given ANY transcript (even if it contains no medication content), return a JSON object with exactly two keys:

1. "summary": an array of 3-5 short strings summarizing what happened in the session. If medications were discussed, cover them. If not, summarize whatever was discussed. Each string should be a clean sentence — no bullet characters, no prefixes.

2. "medications": an array of exactly 3 objects, each with keys: "name", "type", "purpose", "dosage", "status".
   - If medications were mentioned, fill in the details.
   - If no medications were discussed, use: {"name": "N/A", "type": "N/A", "purpose": "N/A", "dosage": "N/A", "status": "safe"}
   Always return exactly 3 items.

CRITICAL RULES:
- NEVER refuse. NEVER ask for more information. NEVER explain yourself.
- ALWAYS return the JSON object even if the transcript is empty, short, or unrelated to medications.
- Return ONLY raw JSON. No markdown fences, no text before or after the JSON.`;

app.post('/summarize', async (req, res) => {
  const { transcript } = req.body || {};

  console.log('📩 Received summarize request');
  console.log('   Transcript length:', Array.isArray(transcript) ? transcript.length : 0, 'messages');
  console.log('');

  if (Array.isArray(transcript)) {
    for (const entry of transcript) {
      const speaker = entry.speaker === 'user' ? '🧑 User' : '🤖 Agent';
      console.log(`   ${speaker}: ${entry.text}`);
    }
  }

  // Build a readable transcript string
  const transcriptText = Array.isArray(transcript)
    ? transcript.map((t: any) => `${t.speaker === 'user' ? 'User' : 'Agent'}: ${t.text}`).join('\n')
    : 'No transcript provided.';

  try {
    console.log('🤖 Invoking Claude to summarize & extract medications...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this medication consultation transcript:\n\n${transcriptText}`,
        },
      ],
    });

    const raw = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('')
      .trim();

    let summary = 'No summary generated.';
    let medications = [
      { name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
      { name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
      { name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
    ];

    try {
      // Strip markdown fences if Claude wraps it
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.summary) {
        // summary can be a string or an array of strings — normalize to bullet string
        if (Array.isArray(parsed.summary)) {
          summary = parsed.summary
            .map((s: string) => s.replace(/^[•\-\s]+/, '').trim())
            .filter((s: string) => s.length > 0)
            .map((s: string) => `• ${s}`)
            .join('\n');
        } else {
          summary = String(parsed.summary);
        }
      }
      if (Array.isArray(parsed.medications)) {
        while (parsed.medications.length < 3) {
          parsed.medications.push({ name: 'N/A', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' });
        }
        medications = parsed.medications.slice(0, 3);
      }
    } catch (e) {
      console.error('⚠️ Could not parse Claude JSON response, extracting text');
      // Try to extract just the summary array from the raw text even if JSON is malformed
      const summaryMatch = raw.match(/"summary"\s*:\s*\[([\s\S]*?)\]/)
      if (summaryMatch) {
        const items = summaryMatch[1].match(/"([^"]+)"/g)
        if (items) {
          summary = items.map((s: string) => s.replace(/^"|"$/g, '').trim()).filter((s: string) => s.length > 0).join('\n')
        }
      } else {
        // Last resort: strip JSON artifacts and use raw text
        summary = raw.replace(/[{}\[\]"]/g, '').replace(/summary|medications|name|type|purpose|dosage|status|safe|N\/A|:\s*/gi, '').trim() || summary
      }
    }

    console.log('');
    console.log('📋 Summary:');
    console.log(summary);
    console.log('💊 Medications:', JSON.stringify(medications, null, 2));
    console.log('');

    res.json({ summary, medications, method: 'claude' });
  } catch (err: any) {
    console.error('❌ Claude summarization failed:', err.message || err);

    // Fallback: return raw transcript bullets
    const fallback = Array.isArray(transcript)
      ? transcript.slice(0, 5).map((t: any) => `• ${t.speaker === 'user' ? 'User' : 'Agent'}: ${t.text}`).join('\n')
      : 'No transcript available.';

    console.log('⚠️ Falling back to raw transcript');
    res.json({ summary: fallback, method: 'fallback' });
  }
});

const PORT = process.env.SUMMARY_PORT || 8082;
app.listen(PORT, () => {
  console.log(`📋 Summary server running on port ${PORT}`);
});
