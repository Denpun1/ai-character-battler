import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { p1, p2, systemPrompt, model, temperature, showThinking, thinkingBudget, provider } = await req.json();

    if (!p1 || !p2) {
      return new Response(JSON.stringify({ error: "Missing characters data" }), { status: 400 });
    }

    const selectedModel = model || 'gemini-2.5-flash';
    const selectedProvider = provider || 'google';
    
    // 1. Logic for Google AI Studio
    if (selectedProvider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Google API Key is missing." }), { status: 500 });
      }

      const ai = new GoogleGenAI({ apiKey });
      let basePrompt = systemPrompt || '以下の2人のキャラクターが熱いバトルを行います。展開と勝敗を出力してください。最後に「勝者: [キャラクター名]」で終わること。';

      // Gemma 4 specific thinking (System Prompt Token)
      if (showThinking && selectedModel.toLowerCase().includes('gemma')) {
        basePrompt = '<|think|>\n' + basePrompt;
      } else if (showThinking) {
        basePrompt = '思考プロセス：シナリオを出力する前に、勝敗を決定するまでの詳細な思考プロセスや戦略の練り込みを、必ず <think> と </think> のタグで囲んで一番最初に出力してください。\n\n' + basePrompt;
      }

      const p1ItemStr = p1.itemDetails ? `装備アイテム: ${p1.itemDetails.name}\n（効果: ${p1.itemDetails.description}）` : '';
      const p2ItemStr = p2.itemDetails ? `装備アイテム: ${p2.itemDetails.name}\n（効果: ${p2.itemDetails.description}）` : '';

      const prompt = `${basePrompt}\n\n【キャラクター1】\n名前: ${p1.name}\n設定/特徴: ${p1.skills}\n${p1ItemStr}\n\n【キャラクター2】\n名前: ${p2.name}\n設定/特徴: ${p2.skills}\n${p2ItemStr}`;

      const config: any = {
        temperature: typeof temperature === 'number' ? temperature : 0.7,
      };

      // Gemini Thinking Budget (Integer Tokens)
      if (thinkingBudget > 0 && selectedModel.toLowerCase().includes('gemini')) {
        config.thinking_config = {
          include_thoughts: true,
          thinking_budget: thinkingBudget,
        };
      }

      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: prompt,
        config: config
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
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    // 2. Logic for Lightning AI (OpenAI Compatible)
    if (selectedProvider === 'lightning') {
      const lightningKey = process.env.LIGHTNING_API_KEY;
      if (!lightningKey) {
        return new Response(JSON.stringify({ error: "Lightning API Key is missing." }), { status: 500 });
      }

      let basePrompt = systemPrompt;
      if (showThinking && selectedModel.toLowerCase().includes('gemma')) {
        basePrompt = '<|think|>\n' + basePrompt;
      }

      const p1ItemStr = p1.itemDetails ? `装備アイテム: ${p1.itemDetails.name}\n（効果: ${p1.itemDetails.description}）` : '';
      const p2ItemStr = p2.itemDetails ? `装備アイテム: ${p2.itemDetails.name}\n（効果: ${p2.itemDetails.description}）` : '';
      const userPrompt = `【キャラクター1】\n名前: ${p1.name}\n設定/特徴: ${p1.skills}\n${p1ItemStr}\n\n【キャラクター2】\n名前: ${p2.name}\n設定/特徴: ${p2.skills}\n${p2ItemStr}`;

      const res = await fetch('https://models.lightning.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lightningKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: basePrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature,
          stream: true
        })
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: `Lightning AI Error: ${err}` }), { status: res.status });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const reader = res.body?.getReader();
          if (!reader) return controller.close();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const cleaned = line.replace(/^data: /, '').trim();
                if (cleaned === '[DONE]') continue;
                if (!cleaned) continue;
                try {
                  const json = JSON.parse(cleaned);
                  const content = json.choices[0]?.delta?.content;
                  if (content) controller.enqueue(content);
                } catch (e) {}
              }
            }
          } catch (e) {
            controller.error(e);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid provider selected" }), { status: 400 });

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Error" }), { status: 500 });
  }
}
