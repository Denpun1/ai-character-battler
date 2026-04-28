"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import styles from '../page.module.css';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableQueueItem } from '@/components/SortableQueueItem';

export default function QueuePage() {
  const { user, isLoaded } = useUser();
  const [queue, setQueue] = useState<any[]>([]);
  const { characters, isLoaded: charsLoaded } = useCharacters();
  const { items, isLoaded: itemsLoaded } = useItems();
  const { settings, isLoaded: settingsLoaded } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedP1, setSelectedP1] = useState('');
  const [selectedP2, setSelectedP2] = useState('');
  const [showQueueModal, setShowQueueModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchQueue = async () => {
    if (user?.id) {
      const { data } = await supabase
        .from('battle_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) setQueue(data);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = queue.findIndex((q) => q.id === active.id);
      const newIndex = queue.findIndex((q) => q.id === over?.id);
      
      const newQueue = arrayMove(queue, oldIndex, newIndex);
      setQueue(newQueue);

      // Persist the new order by updating priority
      // We set priority based on the new index (higher index = lower priority)
      // For simplicity, we'll just update all items' priorities
      const updates = newQueue.map((q, idx) => ({
        id: q.id,
        user_id: user?.id,
        priority: newQueue.length - idx
      }));

      const { error } = await supabase.from('battle_queue').upsert(updates);
      if (error) console.error('Failed to update priority:', error);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      fetchQueue();
    }
  }, [user, isLoaded]);

  const addToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedP1 || !selectedP2) return;

    await supabase.from('battle_queue').insert({
      user_id: user.id,
      p1_id: selectedP1,
      p2_id: selectedP2,
      provider: settings.provider,
      model: settings.model,
      system_prompt: settings.systemPrompt,
      temperature: settings.temperature,
      thinking_budget: settings.thinkingBudget,
      thinking_level: settings.thinkingLevel,
      status: 'pending',
      created_at: Date.now()
    });
    
    setShowQueueModal(false);
    setSelectedP1('');
    setSelectedP2('');
    fetchQueue();
  };

  const processQueue = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      while (true) {
        // Find next task (either pending or previously failed)
        const { data, error: fetchError } = await supabase
          .from('battle_queue')
          .select('*')
          .eq('user_id', user!.id)
          .in('status', ['pending', 'failed'])
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (fetchError || !data) break; // Queue empty or error

        // Set to processing
        await supabase.from('battle_queue').update({ status: 'processing' }).eq('id', data.id);
        fetchQueue();

        // Call API
        let fighters: any[] = [];
        if (data.participant_ids && data.participant_ids.length > 0) {
          fighters = data.participant_ids.map((id: string) => {
            const char = characters.find(c => c.id === id);
            if (!char) return null;
            return { ...char, itemDetails: items.find(i => i.id === (id === data.p1_id ? data.p1_item_id : (id === data.p2_id ? data.p2_item_id : char.itemId))) };
          }).filter(Boolean);
        } else {
          // Fallback to p1/p2
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

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`API Error: ${res.status} - ${errBody}`);
          }

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

          const insertData: any = {
            user_id: user!.id,
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
            console.error('Queue History Save Error:', histError);
            if (histError.message.includes('participant_ids')) {
               const { participant_ids, ...fallbackData } = insertData;
               const { data: fbData, error: fbErr } = await supabase.from('battle_history').insert(fallbackData).select('id').single();
               if (fbErr) throw fbErr;
               await supabase.from('battle_queue').update({ status: 'completed', result_id: fbData.id, error_msg: null }).eq('id', data.id);
            } else {
               throw histError;
            }
          } else {
            await supabase.from('battle_queue').update({ status: 'completed', result_id: histData.id, error_msg: null }).eq('id', data.id);
          }
        } catch (err: any) {
          console.error("Queue process error, retrying...", err);
          await supabase.from('battle_queue').update({ 
            status: 'failed', 
            error_msg: `Error: ${err.message || 'Unknown'}.` 
          }).eq('id', data.id);
          
          fetchQueue();
          await sleep(3000);
          continue; 
        }

        fetchQueue();
      }
    } catch (e: any) {
      console.error("Fatal queue error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteQueueItem = async (id: string) => {
    await supabase.from('battle_queue').delete().eq('id', id);
    fetchQueue();
  };


  if (!isLoaded || !charsLoaded || !settingsLoaded) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'failed').length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Async Battle Queue</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button 
            onClick={processQueue} 
            disabled={isProcessing || pendingCount === 0}
            variant="secondary"
          >
            {isProcessing ? 'Processing...' : `Process Queue (${pendingCount})`}
          </Button>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '4rem' }}>
        {queue.length === 0 ? (
          <div className={styles.emptyState}>Queue is empty. Add battles from the Main Arena!</div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={queue.map(q => q.id)}
              strategy={verticalListSortingStrategy}
            >
              {queue.map(q => {
                const fighterNames = q.participant_ids 
                  ? q.participant_ids.map((id: string) => characters.find(c => c.id === id)?.name || 'Unknown') 
                  : [characters.find(c => c.id === q.p1_id)?.name || 'Unknown', characters.find(c => c.id === q.p2_id)?.name || 'Unknown'];
                
                return (
                  <SortableQueueItem 
                    key={q.id} 
                    q={q} 
                    fighterNames={fighterNames} 
                    deleteQueueItem={deleteQueueItem} 
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {showQueueModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <h2 className={styles.modalTitle}>Add Battle to Queue</h2>
            <form onSubmit={addToQueue}>
              <div className={styles.formGroup}>
                <label>Player 1</label>
                <select className={styles.input} value={selectedP1} onChange={e => setSelectedP1(e.target.value)} required>
                  <option value="" disabled>Select Character</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Player 2</label>
                <select className={styles.input} value={selectedP2} onChange={e => setSelectedP2(e.target.value)} required>
                  <option value="" disabled>Select Character</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666' }}>
                The battle will be added to your queue using your current Settings ({settings.provider}). 
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setShowQueueModal(false)}>Cancel</Button>
                <Button type="submit">Add to Queue</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
