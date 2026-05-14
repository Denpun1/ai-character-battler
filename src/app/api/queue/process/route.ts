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
        
        // Parse custom format: ["charId::itemId1,itemId2", "charId2::"]
        const parsedParticipants = (queueItem.participant_ids || []).map((entry: string) => {
          const [charId, itemIdsStr] = entry.split('::');
          return { charId, itemIds: itemIdsStr ? itemIdsStr.split(',') : [] };
        });

        const [charsRes, itemsRes] = await Promise.all([
          supabase.from('characters').select('*').in('id', parsedParticipants.map((p: any) => p.charId)),
          supabase.from('items').select('*')
        ]);

        const fighters = parsedParticipants.map((p: any) => {
          const char = charsRes.data?.find(c => c.id === p.charId);
          if (!char) return null;
          const equippedItems = itemsRes.data?.filter(i => p.itemIds.includes(i.id)) || [];
          return { ...char, equippedItems };
        }).filter(Boolean);

        if (fighters.length < 2) throw new Error("Invalid fighters configuration (minimum 2 required).");

        // AI Execution
        const provider = queueItem.provider || 'google';
        const modelName = queueItem.model || 'gemma-4-31b-it';
        let fullText = "";

        if (provider === 'google') {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) throw new Error("GEMINI_API_KEY missing.");
          
          const genAI = new GoogleGenAI({ apiKey });
          
          let systemPromptText = '';
          let userPromptText = queueItem.system_prompt || '';
          try {
            const json = JSON.parse(queueItem.system_prompt);
            if (json.isCombinedPrompt) {
               systemPromptText = json.systemPrompt || '';
               userPromptText = json.userPrompt || '';
            }
          } catch(e) {}

          let finalPrompt = userPromptText;
          if (systemPromptText.includes('{{CHARACTERS}}')) {
             systemPromptText = systemPromptText.replace('{{CHARACTERS}}', buildPrompt(queueItem, fighters));
          }
          
          if (finalPrompt.includes('{{CHARACTERS}}')) {
            finalPrompt = finalPrompt.replace('{{CHARACTERS}}', buildPrompt(queueItem, fighters));
          } else {
            // Only append characters to user prompt if they weren't injected into the system prompt either
            if (!systemPromptText.includes(fighters[0]?.name || '')) {
              finalPrompt = `${finalPrompt}\n\n### 参加者データ\n${buildPrompt(queueItem, fighters)}\n\n対戦の最後に必ず「勝者: [キャラクター名]」と記載してください。`.trim();
            }
          }

          const isGemma4 = modelName.toLowerCase().includes('gemma-4');
          const isGemini3 = modelName.toLowerCase().includes('gemini-3');
          const isGemini2 = modelName.toLowerCase().includes('gemini-2');

          const config: any = { 
            temperature: queueItem.temperature || 0.7
          };
          
          if (systemPromptText.trim() !== '') {
            config.systemInstruction = systemPromptText.replace(/~~[\s\S]*?~~/g, '');
          }

          if (queueItem.show_thinking) {
            if (isGemini2 && queueItem.thinking_budget > 0) {
              config.thinkingConfig = { includeThoughts: true, thinkingBudget: queueItem.thinking_budget };
            } else if (isGemma4 || isGemini3) {
              config.thinkingConfig = { includeThoughts: true, thinkingLevel: queueItem.thinking_level || 'high' };
            }
          }

          let retries = 3;
          let attempt = 0;
          while (attempt < retries) {
            try {
              const stream = await genAI.models.generateContentStream({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: finalPrompt.replace(/~~[\s\S]*?~~/g, '') }] }],
                config
              });

              let thoughtText = "";
              let answerText = "";
              for await (const chunk of stream) {
                const parts = chunk.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                  if (part.thought) {
                    thoughtText += part.text;
                  } else if (part.text) {
                    answerText += part.text;
                  }
                }
              }
              
              let rawLog = JSON.stringify({
                endpoint: "Google AI Stream",
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: finalPrompt.replace(/~~[\s\S]*?~~/g, '') }] }],
                config
              }, null, 2);
              
              fullText = answerText;
              if (thoughtText) {
                 fullText = `<think>\n${thoughtText}\n</think>\n\n` + answerText;
              }
              fullText += `\n\n<raw_request>\n${rawLog}\n</raw_request>`;
              break; // Success, exit retry loop
            } catch (err: any) {
              attempt++;
              console.error(`[Google API Error] Attempt ${attempt}/${retries}:`, err.message);
              // Only retry on 500 or 503 Internal Errors
              if (attempt >= retries || (!err.message?.includes('500') && !err.message?.includes('503') && !err.message?.toLowerCase().includes('internal error'))) {
                throw err;
              }
              // Wait 2s, 4s before retrying
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
          }
        } else {
          fullText = await runLightningAI(queueItem, fighters);
        }

        let winnerName = null;
        // Extract winner ONLY from the final answer text to avoid matching thoughts or raw requests
        const textToSearch = fullText.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<raw_request>[\s\S]*?<\/raw_request>/g, '');
        winnerName = textToSearch.match(/勝者[:：]\s*([^<\n]+)/)?.[1]?.trim() || null;

        // Persist Result
        const { data: history, error: histError } = await supabase.from('battle_history').insert({
          user_id: queueItem.user_id,
          p1_id: queueItem.p1_id,
          p2_id: queueItem.p2_id,
          winner_name: winnerName,
          log_text: fullText,
          participant_ids: fighters.map((f: any) => f.id),
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
  fighters.forEach((f) => {
    const itemsStr = f.equippedItems?.length > 0 
      ? `\n装備アイテム:\n` + f.equippedItems.map((item: any) => `・${item.name} - ${item.description || ''}`).join('\n')
      : '';
    p += `\n名前: ${f.name || '不明'}\n説明: ${f.skills || '特になし'}${itemsStr}\n`;
  });
  return p.trim();
}

async function runLightningAI(queueItem: any, fighters: any[]) {
  const lightningKey = process.env.LIGHTNING_API_KEY;
  if (!lightningKey) throw new Error("LIGHTNING_API_KEY is missing.");

  let systemPromptText = '';
  let userPromptText = queueItem.system_prompt || '';
  try {
    const json = JSON.parse(queueItem.system_prompt);
    if (json.isCombinedPrompt) {
        systemPromptText = json.systemPrompt || '';
        userPromptText = json.userPrompt || '';
    }
  } catch(e) {}

  let userContent = userPromptText;
  
  if (systemPromptText.includes('{{CHARACTERS}}')) {
      systemPromptText = systemPromptText.replace('{{CHARACTERS}}', buildPrompt(queueItem, fighters));
  }
  
  if (userContent.includes('{{CHARACTERS}}')) {
     userContent = userContent.replace('{{CHARACTERS}}', buildPrompt(queueItem, fighters));
  } else {
     if (!systemPromptText.includes(fighters[0]?.name || '')) {
       userContent = `${userContent}\n\n### 参加者データ\n${buildPrompt(queueItem, fighters)}\n\n対戦の最後に必ず「勝者: [キャラクター名]」と記載してください。`.trim();
     }
  }

  let retries = 3;
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetch('https://models.lightning.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lightningKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: queueItem.model || 'gemma-4-31b-it',
          messages: [
            { role: 'system', content: systemPromptText.replace(/~~[\s\S]*?~~/g, '') }, 
            { role: 'user', content: userContent.replace(/~~[\s\S]*?~~/g, '') }
          ],
          temperature: queueItem.temperature || 0.7,
          max_tokens: 4096,
          stream: false
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lightning AI request failed with status ${res.status}: ${errText}`);
      }
      
      const data = await res.json();
      
      let rawLog = JSON.stringify({
        endpoint: "Lightning AI Completions",
        model: queueItem.model || 'gemma-4-31b-it',
        messages: [
          { role: 'system', content: systemPromptText.replace(/~~[\s\S]*?~~/g, '') }, 
          { role: 'user', content: userContent.replace(/~~[\s\S]*?~~/g, '') }
        ],
        temperature: queueItem.temperature || 0.7,
        max_tokens: 4096
      }, null, 2);
      
      return data.choices[0].message.content + `\n\n<raw_request>\n${rawLog}\n</raw_request>`;
    } catch (err: any) {
      attempt++;
      console.error(`[Lightning API Error] Attempt ${attempt}/${retries}:`, err.message);
      if (attempt >= retries || (!err.message?.includes('500') && !err.message?.includes('502') && !err.message?.includes('503'))) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  return "";
}
