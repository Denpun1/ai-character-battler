
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';
import { useCharacters } from './useCharacters';
import { useItems } from './useItems';
import { useSettings } from './useSettings';

export type Notification = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  battleId?: string;
};

export function useQueueWorker() {
  const { user } = useUser();
  const { characters } = useCharacters();
  const { items } = useItems();
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info', battleId?: string) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type, battleId }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  }, []);

  const processNext = useCallback(async () => {
    if (!user || isProcessing || !characters.length || !items.length) {
      if (!user) console.log('Queue worker: Waiting for user login...');
      return;
    }

    // Find a pending task
    const { data, error: fetchError } = await supabase
      .from('battle_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !data) return;

    // Try to claim it
    const { error: claimError, count } = await supabase
      .from('battle_queue')
      .update({ status: 'processing' })
      .eq('id', data.id)
      .eq('status', 'pending')
      .select();

    if (claimError || !count) return;

    setIsProcessing(true);
    console.log('Processing queued battle:', data.id);

    try {
      // 1. Prepare fighters
      let fighters: any[] = [];
      if (data.participant_ids && data.participant_ids.length > 0) {
        fighters = data.participant_ids.map((id: string) => {
          const char = characters.find(c => c.id === id);
          if (!char) return null;
          // Determine which item to use (legacy p1/p2 fallback vs character default)
          let itemId = char.itemId;
          if (id === data.p1_id) itemId = data.p1_item_id || itemId;
          else if (id === data.p2_id) itemId = data.p2_item_id || itemId;
          
          return { ...char, itemDetails: items.find(i => i.id === itemId) };
        }).filter(Boolean);
      } else {
        const cp1 = characters.find(c => c.id === data.p1_id);
        const cp2 = characters.find(c => c.id === data.p2_id);
        if (cp1) fighters.push({ ...cp1, itemDetails: items.find(i => i.id === (data.p1_item_id || cp1.itemId)) });
        if (cp2) fighters.push({ ...cp2, itemDetails: items.find(i => i.id === (data.p2_item_id || cp2.itemId)) });
      }

      if (fighters.length < 2) {
        throw new Error('Characters not found for this battle');
      }

      // 2. Call API
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: fighters,
          systemPrompt: data.system_prompt || settings.systemPrompt,
          model: data.model || settings.model,
          temperature: data.temperature || settings.temperature,
          provider: data.provider || settings.provider,
        })
      });

      if (!res.ok) throw new Error('API request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Failed to get stream reader');
      const decoder = new TextDecoder();
      let streamText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamText += decoder.decode(value, { stream: true });
      }

      // 3. Parse Winner
      let matchWinner = null;
      const match = streamText.match(/勝者[:：]\s*(.+)/);
      if (match && match[1]) matchWinner = match[1].trim();

      // 4. Save to History
      const insertData: any = {
        user_id: user.id,
        p1_id: fighters[0].id,
        p2_id: fighters[1].id,
        p1_item_id: fighters[0].itemId || null,
        p2_item_id: fighters[1].itemId || null,
        winner_name: matchWinner,
        log_text: streamText,
        participant_ids: fighters.map(f => f.id),
        created_at: Date.now()
      };

      const { data: histData, error: histError } = await supabase.from('battle_history').insert(insertData).select('id').single();

      if (histError) {
        if (histError.message.includes('participant_ids')) {
          const { participant_ids, ...fb } = insertData;
          const { data: fbData, error: fbErr } = await supabase.from('battle_history').insert(fb).select('id').single();
          if (fbErr) throw fbErr;
          await supabase.from('battle_queue').update({ status: 'completed', result_id: fbData.id }).eq('id', data.id);
          addNotification(`${matchWinner || '対戦'} の生成が完了しました！`, 'success', fbData.id);
        } else {
          throw histError;
        }
      } else {
        await supabase.from('battle_queue').update({ status: 'completed', result_id: histData.id }).eq('id', data.id);
        addNotification(`${matchWinner || '対戦'} の生成が完了しました！`, 'success', histData.id);
      }

    } catch (err: any) {
      console.error('Queue Worker Error:', err);
      await supabase.from('battle_queue').update({ status: 'failed', error_msg: err.message }).eq('id', data.id);
      addNotification(`対戦の生成に失敗しました: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing, characters, items, settings, addNotification]);

  useEffect(() => {
    const timer = setInterval(() => {
      processNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [processNext]);

  return { notifications, removeNotification: (id: string) => setNotifications(prev => prev.filter(n => n.id !== id)) };
}
