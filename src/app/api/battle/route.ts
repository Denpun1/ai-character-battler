import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { p1, p2, systemPrompt, model, temperature, showThinking } = await req.json();

    if (!p1 || !p2) {
      return new Response(JSON.stringify({ error: "Missing characters data" }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key is missing." }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Apply default if settings are not provided or empty
    const selectedModel = model || 'gemini-2.5-flash';
    let basePrompt = systemPrompt || '以下の2人のキャラクターが熱いバトルを行います。展開と勝敗を出力してください。最後に「勝者: [キャラクター名]」で終わること。';

    if (showThinking) {
       basePrompt = '思考プロセス：シナリオを出力する前に、勝敗を決定するまでの詳細な思考プロセスや戦略の練り込みを、必ず <think> と </think> のタグで囲んで一番最初に出力してください。\n\n' + basePrompt;
    }

    const p1ItemStr = p1.itemDetails ? `装備アイテム: ${p1.itemDetails.name}\n（効果: ${p1.itemDetails.description}）` : '';
    const p2ItemStr = p2.itemDetails ? `装備アイテム: ${p2.itemDetails.name}\n（効果: ${p2.itemDetails.description}）` : '';

    const prompt = `
${basePrompt}

【キャラクター1】
名前: ${p1.name}
設定/特徴: ${p1.skills}
${p1ItemStr}

【キャラクター2】
名前: ${p2.name}
設定/特徴: ${p2.skills}
${p2ItemStr}
`;

    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: typeof temperature === 'number' ? temperature : 0.7,
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(chunk.text);
            }
          }
        } catch (err: any) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: { 
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      },
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Error" }), { status: 500 });
  }
}
