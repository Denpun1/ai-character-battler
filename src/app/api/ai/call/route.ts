
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { systemPrompt, userPrompt, provider = 'google' } = await req.json();
    
    if (provider === 'google') {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            systemInstruction: systemPrompt 
        });
        const result = await model.generateContent(userPrompt);
        return NextResponse.json({ text: result.response.text() });
    }
    
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
