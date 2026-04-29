
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'edge';

// Use service role key if available for server-side processing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  let queueId: string | null = null;
  try {
    const body = await req.json();
    queueId = body.queueId;
    const userId = body.userId;

    // 1. Fetch the queue item
    const { data: queueItem, error: fetchError } = await supabase
      .from('battle_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError || !queueItem) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    if (queueItem.status === 'completed') {
      return NextResponse.json({ message: "Already completed" });
    }

    // 2. Mark as processing
    await supabase.from('battle_queue').update({ status: 'processing', created_at: Date.now() }).eq('id', queueId);

    // 3. Prepare characters and items
    // Since we are server-side, we need to fetch character/item details
    const { data: chars } = await supabase.from('characters').select('*').in('id', queueItem.participant_ids || [queueItem.p1_id, queueItem.p2_id]);
    const { data: items } = await supabase.from('items').select('*');

    if (!chars || chars.length < 2) throw new Error("Characters not found");

    const fighters = chars.map(c => {
      let itemId = c.itemId;
      if (c.id === queueItem.p1_id) itemId = queueItem.p1_item_id || itemId;
      if (c.id === queueItem.p2_id) itemId = queueItem.p2_item_id || itemId;
      return { ...c, itemDetails: items?.find(i => i.id === itemId) };
    });

    // 4. Run AI (Gemini) with Streaming
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Build prompt
    let prompt = `${queueItem.system_prompt}\n\n`;
    fighters.forEach((f, idx) => {
      prompt += `【Fighter ${idx+1}】\nName: ${f.name}\nSkills: ${f.skills}\nItem: ${f.itemDetails?.name || 'None'}\n\n`;
    });

    const selectedModel = queueItem.model || "gemma-4-31b-it";

    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: typeof queueItem.temperature === 'number' ? queueItem.temperature : 0.7,
      }
    });

    let fullText = '';
    const startTime = Date.now();
    try {
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
        }
        // Safety cutoff at 55 seconds
        if (Date.now() - startTime > 55000) {
          console.log("Edge safety cutoff reached (55s). Finalizing partial result.");
          break;
        }
      }
    } catch (e: any) {
      console.error("Streaming error:", e);
      // Even if streaming fails halfway, we might have enough text
      if (fullText.length < 50) throw e;
    }

    // 5. Parse Winner
    let winnerName = null;
    const match = fullText.match(/勝者[:：]\s*(.+)/);
    if (match && match[1]) winnerName = match[1].trim();

    // 6. Save to History
    const { data: histData, error: histError } = await supabase.from('battle_history').insert({
      user_id: queueItem.user_id,
      p1_id: fighters[0].id,
      p2_id: fighters[1].id,
      p1_item_id: fighters[0].itemId || null,
      p2_item_id: fighters[1].itemId || null,
      winner_name: winnerName,
      log_text: fullText,
      participant_ids: fighters.map(f => f.id),
      created_at: Date.now()
    }).select('id').single();

    if (histError) throw histError;

    // 7. Finalize Queue
    await supabase.from('battle_queue').update({ 
      status: 'completed', 
      result_id: histData.id,
      winner_name: winnerName 
    }).eq('id', queueId);

    return NextResponse.json({ success: true, historyId: histData.id });

  } catch (error: any) {
    console.error("Server Worker Error:", error);
    await supabase.from('battle_queue').update({ status: 'failed', error_msg: error.message }).eq('id', queueId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
