
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'edge';

// Initialize Supabase with Service Role for administrative DB access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * NEW QUEUE PROCESSOR (REBUILT FROM ZERO)
 * This API is designed to be called by a Supabase Webhook or a client trigger.
 */
export async function POST(req: NextRequest) {
  let queueId: string | null = null;
  
  try {
    const body = await req.json();
    // Support both direct ID call and Supabase Webhook payload
    queueId = body.record?.id || body.queueId;
    
    if (!queueId) return NextResponse.json({ error: "Missing queue ID" }, { status: 400 });

    // 1. ATOMIC LOCK & FETCH
    // We check if it's already being processed to prevent race conditions
    const { data: queueItem, error: fetchError } = await supabase
      .from('battle_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) throw new Error("Task not found in queue.");
    if (queueItem.status === 'completed') return NextResponse.json({ message: "Already finished." });
    
    // 2. MARK AS PROCESSING (With timestamp for watchdog)
    await supabase.from('battle_queue').update({ 
      status: 'processing', 
      started_at: new Date().toISOString() 
    }).eq('id', queueId);

    // 3. FETCH CONTEXT (Characters, Items)
    const [charsRes, itemsRes] = await Promise.all([
      supabase.from('characters').select('*').in('id', queueItem.participant_ids || []),
      supabase.from('items').select('*')
    ]);

    const fighters = charsRes.data?.map(c => ({
      ...c,
      itemDetails: itemsRes.data?.find(i => i.id === (c.id === queueItem.p1_id ? queueItem.p1_item_id : queueItem.p2_item_id) || c.itemId)
    })) || [];

    if (fighters.length < 2) throw new Error("Fighters configuration is invalid.");

    // 4. EXECUTE AI BATTLE
    const provider = queueItem.provider || 'google';
    const modelName = queueItem.model || 'gemma-4-31b-it';
    let fullText = "";

    if (provider === 'google') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Environment Error: GEMINI_API_KEY is missing.");
      
      const genAI = new GoogleGenAI({ apiKey });
      const stream = await genAI.models.generateContentStream({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: buildPrompt(queueItem, fighters) }] }],
        config: { temperature: queueItem.temperature || 0.7 }
      });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI Timeout")), 55000));
      
      try {
        for await (const chunk of stream) {
          if (chunk.text) fullText += chunk.text;
          if (Date.now() - new Date(queueItem.started_at || Date.now()).getTime() > 55000) break;
        }
      } catch (e: any) {
        if (fullText.length < 100) throw e; // Only fail if we got almost nothing
      }
    } else {
      // Lightning AI / Other Provider implementation
      fullText = await runLightningAI(queueItem, fighters);
    }

    // 5. PARSE & PERSIST
    const winnerName = fullText.match(/勝者[:：]\s*(.+)/)?.[1]?.trim() || null;

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

    // 6. FINALIZE QUEUE
    await supabase.from('battle_queue').update({
      status: 'completed',
      result_id: history.id,
      winner_name: winnerName
    }).eq('id', queueId);

    return NextResponse.json({ success: true, historyId: history.id });

  } catch (error: any) {
    console.error("QUEUE_SYSTEM_ERROR:", error);
    if (queueId) {
      await supabase.from('battle_queue').update({ 
        status: 'failed', 
        error_msg: error.message 
      }).eq('id', queueId);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildPrompt(queueItem: any, fighters: any[]) {
  let p = `${queueItem.system_prompt}\n\n`;
  fighters.forEach((f, i) => {
    p += `Fighter ${i+1}: ${f.name}\nSkills: ${f.skills}\nItem: ${f.itemDetails?.name || 'None'}\n\n`;
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
      messages: [{ role: 'system', content: queueItem.system_prompt }, { role: 'user', content: buildPrompt(queueItem, fighters) }],
      stream: false // Non-stream for simplicity in rebuilt core
    })
  });
  if (!res.ok) throw new Error("Lightning AI request failed.");
  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}
