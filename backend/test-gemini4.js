const WebSocketClient = require('ws');
const dotenv = require('dotenv');
dotenv.config({path: '.env'});

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GENAI_API_KEY}`;
const ws = new WebSocketClient(url);

ws.on('open', () => {
    console.log("Connected");
    const setup = {
        setup: {
            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }
    };
    ws.send(JSON.stringify(setup));
});

ws.on('close', (code, reason) => {
    console.log("Closed:", code, reason.toString());
});
ws.on('message', (data) => console.log('msg', data.toString()));
