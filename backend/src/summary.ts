import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = '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';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const SYSTEM_PROMPT = `You are a concise medical session summarizer. Distill the transcript into 3-5 short bullet points covering: medications discussed, safety concerns flagged, and any action items. No filler, no repeating verbatim quotes. Be clinical and direct. Each bullet should start with "•". Do not include any preamble or closing remarks — only the bullet points.`;

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
    console.log('🤖 Invoking Claude Opus to summarize...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Summarize this medication consultation transcript into concise bullet points:\n\n${transcriptText}`,
        },
      ],
    });

    const summary = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n')
      .trim() || 'No summary generated.';

    console.log('');
    console.log('📋 Summary:');
    console.log(summary);
    console.log('');

    res.json({ summary, method: 'claude-opus' });
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

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`📋 Summary server running on port ${PORT}`);
});
