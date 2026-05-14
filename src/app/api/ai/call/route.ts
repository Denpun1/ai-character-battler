
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { systemPrompt, userPrompt } = await req.json();
    
    const client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    });

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
    });
    
    return NextResponse.json({ text: response.text() });
  } catch (error: any) {
    console.error('[AI Call API Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
