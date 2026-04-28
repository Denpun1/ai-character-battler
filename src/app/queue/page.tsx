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
      const interval = setInterval(fetchQueue, 3000);
      return () => clearInterval(interval);
    }
  }, [user, isLoaded]);

  const deleteQueueItem = async (id: string) => {
    await supabase.from('battle_queue').delete().eq('id', id);
    fetchQueue();
  };


  if (!isLoaded || !charsLoaded || !settingsLoaded) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Async Battle Queue</h1>
        <p style={{ color: '#888' }}>
          Battles are processed automatically in the background. 
          Notifications will appear when they are ready.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '4rem' }}>
        {queue.length === 0 ? (
          <div className={styles.emptyState}>Queue is empty. Start a fight from the Main Arena!</div>
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

    </div>
  );
}
