import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';

export function useQueue(userId: string | undefined, characters: any[], items: any[]) {
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('battle_queue')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setQueue(data);
  }, [userId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = queue.findIndex((q) => q.id === active.id);
      const newIndex = queue.findIndex((q) => q.id === over?.id);
      
      const newQueue = arrayMove(queue, oldIndex, newIndex);
      setQueue(newQueue);

      const updates = newQueue.map((q, idx) => ({
        id: q.id,
        user_id: userId,
        priority: newQueue.length - idx
      }));

      const { error } = await supabase.from('battle_queue').upsert(updates);
      if (error) console.error('Failed to update priority:', error);
    }
  };

  const deleteQueueItem = async (id: string) => {
    await supabase.from('battle_queue').delete().eq('id', id);
    fetchQueue();
  };

  const processQueue = async (settings: any) => {
    if (isProcessing || !userId) return;
    setIsProcessing(true);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      while (true) {
        const { data, error: fetchError } = await supabase
          .from('battle_queue')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['pending', 'failed'])
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (fetchError || !data) break;

        await supabase.from('battle_queue').update({ status: 'processing' }).eq('id', data.id);
        fetchQueue();

        let fighters: any[] = [];
        if (data.participant_ids && data.participant_ids.length > 0) {
          fighters = data.participant_ids.map((id: string) => {
            const char = characters.find(c => c.id === id);
            if (!char) return null;
            return { ...char, itemDetails: items.find(i => i.id === (id === data.p1_id ? data.p1_item_id : (id === data.p2_id ? data.p2_item_id : char.itemId))) };
          }).filter(Boolean);
        } else {
          const cp1 = characters.find(c => c.id === data.p1_id);
          const cp2 = characters.find(c => c.id === data.p2_id);
          if (cp1) fighters.push({ ...cp1, itemDetails: items.find(i => i.id === (data.p1_item_id || cp1.itemId)) });
          if (cp2) fighters.push({ ...cp2, itemDetails: items.find(i => i.id === (data.p2_item_id || cp2.itemId)) });
        }
        
        if (fighters.length < 2) {
           await supabase.from('battle_queue').update({ status: 'failed', error_msg: 'Characters not found' }).eq('id', data.id);
           fetchQueue();
           continue;
        }

        try {
          const res = await fetch('/api/battle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              players: fighters,
              systemPrompt: data.system_prompt,
              model: data.model,
              temperature: data.temperature,
              showThinking: data.show_thinking,
              thinkingBudget: data.thinking_budget,
              thinkingLevel: data.thinking_level,
              provider: data.provider
            })
          });

          if (!res.ok) throw new Error(`API Error: ${res.status}`);

          const reader = res.body?.getReader();
          if (!reader) throw new Error('No reader available');

          const decoder = new TextDecoder();
          let streamText = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            streamText += decoder.decode(value, { stream: true });
          }
          
          let matchWinner = null;
          const match = streamText.match(/勝者[:：]\s*(.+)/);
          if (match && match[1]) matchWinner = match[1].trim();

          const { data: histData, error: histError } = await supabase.from('battle_history').insert({
            user_id: userId,
            p1_id: fighters[0].id,
            p2_id: fighters[1].id,
            winner_name: matchWinner,
            log_text: streamText,
            participant_ids: fighters.map(f => f.id),
            created_at: Date.now()
          }).select('id').single();

          if (histError) throw histError;
          await supabase.from('battle_queue').update({ status: 'completed', result_id: histData.id, error_msg: null }).eq('id', data.id);
        } catch (err: any) {
          console.error("Queue process error:", err);
          await supabase.from('battle_queue').update({ status: 'failed', error_msg: err.message }).eq('id', data.id);
          fetchQueue();
          await sleep(3000);
          continue; 
        }
        fetchQueue();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return { queue, isProcessing, fetchQueue, handleDragEnd, deleteQueueItem, processQueue };
}
