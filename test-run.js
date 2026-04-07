require('dotenv/config');
const { GoogleGenAI } = require('@google/genai');

async function run() {
  try {
    const ai = new GoogleGenAI(); // It uses GEMINI_API_KEY from environment
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'reply with "ok"',
    });
    console.log("TEXT:", response.text);
  } catch(e) {
    console.log("ERROR:", e.message);
  }
}
run();
