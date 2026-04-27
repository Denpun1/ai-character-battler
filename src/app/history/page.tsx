"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import styles from '../page.module.css';
import { useCharacters } from '@/hooks/useCharacters';

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const [history, setHistory] = useState<any[]>([]);
  const { characters, isLoaded: charsLoaded } = useCharacters();

  useEffect(() => {
    if (isLoaded && user) {
      supabase
        .from('battle_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setHistory(data);
        });
    }
  }, [user, isLoaded]);

  if (!isLoaded || !charsLoaded) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Battle History</h1>
      </header>

      {history.length === 0 ? (
        <div className={styles.emptyState}>No battles yet. Start a fight in the Arena!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '4rem' }}>
          {history.map(h => {
             const p1 = characters.find(c => c.id === h.p1_id)?.name || 'Unknown Character';
             const p2 = characters.find(c => c.id === h.p2_id)?.name || 'Unknown Character';
             return (
               <Card key={h.id}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div>
                     <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{p1} <span style={{ color: '#888', fontSize: '1rem' }}>vs</span> {p2}</h3>
                     <p style={{ fontWeight: 'bold', color: h.winner_name ? 'var(--primary)' : 'inherit' }}>
                       Winner: {h.winner_name || 'Undecided / Error'}
                     </p>
                   </div>
                   <div style={{ color: '#888', fontSize: '0.9rem' }}>
                     {new Date(Number(h.created_at)).toLocaleString()}
                   </div>
                 </div>
                 
                 <details style={{ marginTop: '1rem' }}>
                   <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 }}>View Full Log</summary>
                   <div style={{ 
                     whiteSpace: 'pre-wrap', 
                     marginTop: '1rem', 
                     background: 'var(--card-bg)', 
                     border: '1px solid var(--border)',
                     padding: '1rem', 
                     borderRadius: '8px',
                     maxHeight: '400px',
                     overflowY: 'auto',
                     fontSize: '0.95rem',
                     lineHeight: '1.6'
                   }}>
                     {h.log_text}
                   </div>
                 </details>
               </Card>
             );
          })}
        </div>
      )}
    </div>
  );
}
