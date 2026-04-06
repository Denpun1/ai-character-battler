import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { p1, p2 } = await req.json();

    if (!p1 || !p2) {
      return new Response(JSON.stringify({ error: "Missing characters data" }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API Key is missing. Please set it in .env.local" }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下の2人のキャラクターが熱いバトルを行います。
設定に基づいて、臨場感のある劇的なバトルの展開と、最終的にどちらが勝つかを決定し、シナリオを出力してください。
文章はゲームの実況や小説のようなドラマチックなトーンで作成してください。

【キャラクター1】
名前: ${p1.name}
スキル・特徴: ${p1.skills}

【キャラクター2】
名前: ${p2.name}
スキル・特徴: ${p2.skills}

出力要件:
1. バトル開始の状況（両者の対峙）
2. スキルを駆使した激しい攻防（2〜3ターンのラリー）
3. クライマックスの決定打
4. 明確な勝者の宣言（最後に「勝者: [キャラクター名]」という形式で終わること）
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return new Response(JSON.stringify({ result: response.text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Something went wrong" }), { status: 500 });
  }
}
