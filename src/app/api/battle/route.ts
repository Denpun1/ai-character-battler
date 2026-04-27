import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { 
      players, 
      p1, p2, // Keep for backward compatibility
      systemPrompt, 
      model, 
      temperature, 
      showThinking, 
      thinkingBudget, 
      thinkingLevel, 
      provider,
      isEpilogue,
      context
    } = await req.json();

    // Support both players array and legacy p1/p2
    const finalPlayers = players || (p1 && p2 ? [p1, p2] : []);

    if (finalPlayers.length === 0 && !isEpilogue) {
      return new Response(JSON.stringify({ error: "Missing characters data" }), { status: 400 });
    }

    const selectedModel = model || 'gemini-2.5-flash';
    const selectedProvider = provider || 'google';
    const isGemma4 = selectedModel.toLowerCase().includes('gemma-4');
    const isGemini3 = selectedModel.toLowerCase().includes('gemini-3');
    const isGemini2 = selectedModel.toLowerCase().includes('gemini-2');
    
    // 1. Logic for Google AI Studio
    if (selectedProvider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Google API Key is missing." }), { status: 500 });
      }

      const ai = new GoogleGenAI({ apiKey });
      let basePrompt = systemPrompt || (isEpilogue ? '後日譚を作成してください。' : '以下のキャラクターたちが熱いバトルを行います。展開と勝敗を出力してください。最後に「勝者: [キャラクター名]」で終わること。');

      // Thinking specific prompt logic
      if (showThinking) {
        if (selectedModel.toLowerCase().includes('gemma')) {
          basePrompt = '<|think|>\n' + basePrompt;
        } else {
          basePrompt = '思考プロセス：出力を行う前に、詳細な思考プロセスを必ず <think> と </think> のタグで囲んで一番最初に出力してください。\n\n' + basePrompt;
        }
      }

      let playerInfo = '';
      finalPlayers.forEach((p: any, idx: number) => {
        const itemStr = p.itemDetails ? `装備アイテム: ${p.itemDetails.name}\n（効果: ${p.itemDetails.description}）` : '';
        playerInfo += `【キャラクター${idx + 1}】\n名前: ${p.name}\n設定/特徴: ${p.skills}\n${itemStr}\n\n`;
      });

      let prompt = '';
      if (isEpilogue) {
        prompt = `${basePrompt}\n\n【これまでのバトルの流れ】\n${context}\n\n【登場キャラクター設定】\n${playerInfo}`;
      } else {
        prompt = `${basePrompt}\n\n${playerInfo}`;
      }

      const config: any = {
        temperature: typeof temperature === 'number' ? temperature : 0.7,
      };

      if (showThinking) {
        if (isGemini2 && thinkingBudget > 0) {
          config.thinking_config = { include_thoughts: true, thinking_budget: thinkingBudget };
        } else if (isGemma4 || isGemini3) {
          config.thinking_config = { include_thoughts: true, thinking_level: thinkingLevel || 'HIGH' };
        }
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
              if (chunk.text) controller.enqueue(chunk.text);
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

      let playerInfo = '';
      finalPlayers.forEach((p: any, idx: number) => {
        const itemStr = p.itemDetails ? `装備アイテム: ${p.itemDetails.name}\n（効果: ${p.itemDetails.description}）` : '';
        playerInfo += `【キャラクター${idx + 1}】\n名前: ${p.name}\n設定/特徴: ${p.skills}\n${itemStr}\n\n`;
      });

      let userPrompt = '';
      if (isEpilogue) {
        userPrompt = `【これまでのバトルの流れ】\n${context}\n\n【登場キャラクター設定】\n${playerInfo}`;
      } else {
        userPrompt = playerInfo;
      }

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
