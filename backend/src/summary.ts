import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY || 'empty_key' });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

const SYSTEM_PROMPT = `You are a clinical session summarizer. 
CRITICAL RULE: Summarize ONLY the provided transcript. 
NEVER imagine medications, user symptoms, or dialogue that is not in the text.
If the transcript is short, the summary MUST be short. 

The transcript includes Agent "Thinking" blocks wrapped in **. Use these to understand the context, but focus the summary on the actual events.

Return a JSON object:
1. "summary": A single string paragraph.
2. "medications": An array of exactly 3 objects: { "name", "type", "purpose", "dosage", "status" }. 
Use "N/A" and "safe" for medications if none were found. Return ONLY raw JSON.`;

app.post('/summarize', async (req, res) => {
  const { transcript } = req.body || {};
  console.log(`📩 Summarize request: ${Array.isArray(transcript) ? transcript.length : 0} messages.`);

  const transcriptText = Array.isArray(transcript) && transcript.length > 0
    ? transcript.map((t: any) => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n')
    : 'Empty transcript.';

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', 
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages:[{ role: 'user', content: `Analyze this transcript strictly:\n\n${transcriptText}` }],
    });

    const raw = message.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    let summary = "Summary generated.";
    let medications = [
        { name: 'N/A (1)', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
        { name: 'N/A (2)', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
        { name: 'N/A (3)', type: 'N/A', purpose: 'N/A', dosage: 'N/A', status: 'safe' as const },
    ];

    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      summary = Array.isArray(parsed.summary) ? parsed.summary.join(' ') : String(parsed.summary);
      if (Array.isArray(parsed.medications)) medications = parsed.medications.slice(0, 3);
    } catch (e) {
      summary = raw;
    }

    res.json({ summary, medications, method: 'claude' });
  } catch (err: any) {
    res.json({ summary: "AI failed to summarize.", medications: [], method: 'error' });
  }
});

const PORT = 8082;
app.listen(PORT, () => console.log(`📋 Summary server live on ${PORT}`));