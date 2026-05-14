
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { systemPrompt, userPrompt, provider = 'google' } = await req.json();
    
    if (provider === 'google') {
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        
        const result = await genAI.models.generateContent({
            model: "gemini-2.0-flash",
            systemInstruction: systemPrompt,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        });
        return NextResponse.json({ text: result.response.text() });
    }
    
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
