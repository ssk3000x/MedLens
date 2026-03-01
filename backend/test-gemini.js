const WebSocketClient = require('ws');
const dotenv = require('dotenv');
dotenv.config();

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
const ws = new WebSocketClient(url);

ws.on('open', () => {
    ws.send(JSON.stringify({
        setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }
    }));
});

ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    console.log(JSON.stringify(response, null, 2));
    if (response.setupComplete) {
       console.log("Setup complete, sending prompt");
       ws.send(JSON.stringify({
           clientContent: {
               turns: [{
                   role: "user",
                   parts: [{ text: "Hello, say a short sentence." }]
               }],
               turnComplete: true
           }
       }));
    }
});

ws.on('error', console.error);
