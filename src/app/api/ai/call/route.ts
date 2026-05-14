
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { systemPrompt, userPrompt, provider = 'google' } = await req.json();
    
    if (provider === 'google') {
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
            ],
            config: {
                maxOutputTokens: 8192,
                temperature: 0.7
            }
        });
        
        return NextResponse.json({ text: result.candidates?.[0]?.content?.parts?.[0]?.text || '' });
    }
    
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error: any) {
    console.error("AI Call API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
