import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

const app = express();
app.use(cors());
app.use(express.json());

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

  if (!VAPI_API_KEY) {
    return res.status(500).json({ error: 'VAPI_API_KEY not configured' });
  }
  if (!VAPI_PHONE_NUMBER_ID) {
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
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
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

const PORT = process.env.VAPI_PORT || 8083;
app.listen(PORT, () => {
  console.log(`📞 VAPI voice agent server running on port ${PORT}`);
});
