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

  const fetchQueue = async () => {
    if (user?.id) {
      const { data } = await supabase
        .from('battle_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setQueue(data);
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
          queue.map(q => {
            const fighterNames = q.participant_ids 
              ? q.participant_ids.map((id: string) => characters.find(c => c.id === id)?.name || 'Unknown') 
              : [characters.find(c => c.id === q.p1_id)?.name || 'Unknown', characters.find(c => c.id === q.p2_id)?.name || 'Unknown'];
            
            let statusColor = '#888';
            if (q.status === 'pending') statusColor = '#d97706';
            if (q.status === 'processing') statusColor = '#2563eb';
            if (q.status === 'completed') statusColor = '#16a34a';
            if (q.status === 'failed') statusColor = '#dc2626';

            return (
              <Card key={q.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>{fighterNames.filter((n: string) => n !== 'Unknown').join(' vs ') || 'Unknown Battle'}</h3>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ color: statusColor, fontWeight: 'bold' }}> {q.status.toUpperCase()} </span>
                      <span style={{ color: '#666' }}>{q.provider} / {q.model}</span>
                      <span style={{ color: '#888' }}>{new Date(q.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    {q.status !== 'processing' && (
                      <Button variant="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => deleteQueueItem(q.id)}>Delete</Button>
                    )}
                  </div>
                </div>
                {q.error_msg && <p style={{ color: '#dc2626', marginTop: '0.5rem', fontSize: '0.85rem', background: 'rgba(220, 38, 38, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{q.error_msg}</p>}
              </Card>
            );
          })
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
