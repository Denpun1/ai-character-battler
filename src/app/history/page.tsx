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
             return (
                <Card key={h.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                        {h.participant_ids && h.participant_ids.length > 0 ? (
                          h.participant_ids.map((pid: string, idx: number) => (
                            <span key={pid}>
                              <span style={{ fontWeight: 'bold' }}>{characters.find(c => c.id === pid)?.name || 'Unknown'}</span>
                              {idx < h.participant_ids.length - 1 && <span style={{ color: '#888', marginLeft: '0.4rem' }}>vs</span>}
                            </span>
                          ))
                        ) : (
                          (() => {
                            // Try to parse names from log if participant_ids is missing
                            const names: string[] = [];
                            const nameMatches = h.log_text?.matchAll(/【キャラクター\d+】\s*名前:\s*(.+)/g);
                            if (nameMatches) {
                              for (const m of nameMatches) if (m[1]) names.push(m[1].trim());
                            }
                            
                            if (names.length > 0) {
                              return names.map((name, idx) => (
                                <span key={idx}>
                                  <span style={{ fontWeight: 'bold' }}>{name}</span>
                                  {idx < names.length - 1 && <span style={{ color: '#888', marginLeft: '0.4rem' }}>vs</span>}
                                </span>
                              ));
                            }

                            // Last fallback to p1/p2
                            return (
                              <>
                                <span style={{ fontWeight: 'bold' }}>{characters.find(c => c.id === h.p1_id)?.name || 'Unknown'}</span>
                                <span style={{ color: '#888' }}>vs</span>
                                <span style={{ fontWeight: 'bold' }}>{characters.find(c => c.id === h.p2_id)?.name || 'Unknown'}</span>
                              </>
                            );
                          })()
                        )}
                      </div>
                      <p style={{ fontWeight: 'bold', color: h.winner_name ? 'var(--primary)' : 'inherit', fontSize: '1.2rem' }}>
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
                     {(() => {
                       if (h.log_text) {
                         const cleanedLog = h.log_text.replace(/```json/gi, '').replace(/```/g, '').trim();
                         if (cleanedLog.startsWith('{')) {
                           try {
                             const parsed = JSON.parse(cleanedLog);
                             return (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                 {parsed.log && <div style={{ whiteSpace: 'pre-wrap' }}>{parsed.log}</div>}
                               </div>
                             );
                           } catch (e) {
                             return <div style={{ whiteSpace: 'pre-wrap' }}>{cleanedLog}</div>;
                           }
                         }
                         return <div style={{ whiteSpace: 'pre-wrap' }}>{cleanedLog}</div>;
                       }
                       return null;
                     })()}
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
