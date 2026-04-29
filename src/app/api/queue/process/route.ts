
import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'edge';

// Initialize Supabase with Service Role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  let queueId: string | null = null;
  
  try {
    const body = await req.json();
    queueId = body.record?.id || body.queueId;
    if (!queueId) return NextResponse.json({ error: "Missing queue ID" }, { status: 400 });

    // 1. Initial Fetch & Lock
    const { data: queueItem, error: fetchError } = await supabase
      .from('battle_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) throw new Error("Task not found.");
    if (queueItem.status === 'completed') return NextResponse.json({ message: "Already finished." });
    
    // 2. Mark as Processing
    await supabase.from('battle_queue').update({ 
      status: 'processing', 
      started_at: new Date().toISOString() 
    }).eq('id', queueId);

    // --- FIRE AND FORGET START ---
    // The 'after' hook ensures this runs even after the response is sent
    after(async () => {
      try {
        console.log(`[Worker] Starting background process for ${queueId}`);
        
        // Fetch Context
        const [charsRes, itemsRes] = await Promise.all([
          supabase.from('characters').select('*').in('id', queueItem.participant_ids || []),
          supabase.from('items').select('*')
        ]);

        const fighters = charsRes.data?.map(c => ({
          ...c,
          itemDetails: itemsRes.data?.find(i => i.id === (c.id === queueItem.p1_id ? queueItem.p1_item_id : queueItem.p2_item_id) || c.itemId)
        })) || [];

        if (fighters.length < 2) throw new Error("Invalid fighters configuration.");

        // AI Execution
        const provider = queueItem.provider || 'google';
        const modelName = queueItem.model || 'gemma-4-31b-it';
        let fullText = "";

        if (provider === 'google') {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) throw new Error("GEMINI_API_KEY missing.");
          
          const genAI = new GoogleGenAI({ apiKey });
          const finalPrompt = `${queueItem.system_prompt}\n\n${buildPrompt(queueItem, fighters)}`;
          const stream = await genAI.models.generateContentStream({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
            config: { 
              temperature: queueItem.temperature || 0.7,
              maxOutputTokens: 8192,
              responseMimeType: queueItem.json_mode ? 'application/json' : 'text/plain',
            }
          });

          for await (const chunk of stream) {
            if (chunk.text) fullText += chunk.text;
          }
        } else {
          fullText = await runLightningAI(queueItem, fighters);
        }

        let winnerName = null;
        if (queueItem.json_mode) {
          try {
            const parsed = JSON.parse(fullText);
            winnerName = parsed.winner || null;
          } catch (e) {
            winnerName = fullText.match(/勝者[:：]\s*(.+)/)?.[1]?.trim() || null;
          }
        } else {
          winnerName = fullText.match(/勝者[:：]\s*(.+)/)?.[1]?.trim() || null;
        }

        // Persist Result
        const { data: history, error: histError } = await supabase.from('battle_history').insert({
          user_id: queueItem.user_id,
          p1_id: queueItem.p1_id,
          p2_id: queueItem.p2_id,
          winner_name: winnerName,
          log_text: fullText,
          participant_ids: fighters.map(f => f.id),
          created_at: Date.now()
        }).select('id').single();

        if (histError) throw histError;

        // Finalize
        await supabase.from('battle_queue').update({
          status: 'completed',
          result_id: history.id,
          winner_name: winnerName
        }).eq('id', queueId);

        console.log(`[Worker] Successfully completed ${queueId}`);

      } catch (err: any) {
        console.error(`[Worker Error] ${queueId}:`, err);
        await supabase.from('battle_queue').update({ 
          status: 'failed', 
          error_msg: err.message 
        }).eq('id', queueId);
      }
    });
    // --- FIRE AND FORGET END ---

    // Return immediately to the client
    return NextResponse.json({ success: true, status: 'queued' }, { status: 202 });

  } catch (error: any) {
    console.error("QUEUE_TRIGGER_ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildPrompt(queueItem: any, fighters: any[]) {
  let p = "";
  fighters.forEach((f, i) => {
    p += `【キャラクター${i + 1}】\n名前: ${f.name}\n特徴/スキル: ${f.skills}\n装備アイテム: ${f.itemDetails?.name || 'なし'}\n\n`;
  });
  return p;
}

async function runLightningAI(queueItem: any, fighters: any[]) {
  const lightningKey = process.env.LIGHTNING_API_KEY;
  if (!lightningKey) throw new Error("LIGHTNING_API_KEY is missing.");

  const res = await fetch('https://models.lightning.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lightningKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: queueItem.model || 'gemma-4-31b-it',
      messages: [
        { role: 'system', content: queueItem.system_prompt || '' }, 
        { role: 'user', content: buildPrompt(queueItem, fighters) }
      ],
      temperature: queueItem.temperature || 0.7,
      response_format: queueItem.json_mode ? { type: "json_object" } : undefined,
      max_tokens: 4096,
      stream: false
    })
  });
  if (!res.ok) throw new Error("Lightning AI request failed.");
  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}
