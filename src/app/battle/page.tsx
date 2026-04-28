"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/Button';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

function BattleArena() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, isLoaded } = useCharacters();
  const { items, isLoaded: itemsLoaded } = useItems();
  const { settings, isLoaded: settingsLoaded } = useSettings();
  const { user } = useUser();

  const [fighters, setFighters] = useState<any[]>([]);
  const [battleLog, setBattleLog] = useState<string>('');
  const [epilogueLog, setEpilogueLog] = useState<string>('');
  const [isFighting, setIsFighting] = useState(false);
  const [isEpiloguing, setIsEpiloguing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const playersParam = searchParams.get('players') || '';
  const storageKey = `current_battle_${playersParam}`;

  // Load state from localStorage on mount or when players change
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setBattleLog(data.battleLog || '');
        setEpilogueLog(data.epilogueLog || '');
        setWinner(data.winner || null);
        setIsFinished(data.isFinished || false);
      } catch (e) {
        console.error('Error loading battle state:', e);
      }
    } else {
      // Clear if no saved state for this specific player combo
      setBattleLog('');
      setEpilogueLog('');
      setWinner(null);
      setIsFinished(false);
    }
  }, [storageKey]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (battleLog || epilogueLog || isFinished) {
      localStorage.setItem(storageKey, JSON.stringify({
        battleLog, epilogueLog, winner, isFinished
      }));
    }
  }, [storageKey, battleLog, epilogueLog, winner, isFinished]);

  useEffect(() => {
    if (isLoaded && settingsLoaded && itemsLoaded) {
      const overridesParam = searchParams.get('overrides');
      
      let ids: string[] = [];
      if (playersParam) {
        ids = playersParam.split(',');
      } else {
        const p1 = searchParams.get('p1');
        const p2 = searchParams.get('p2');
        if (p1) ids.push(p1);
        if (p2) ids.push(p2);
      }

      if (ids.length < 2) {
        router.push('/');
        return;
      }

      const overrides: Record<string, string> = {};
      if (overridesParam) {
        overridesParam.split('|').forEach(part => {
          const [id, item] = part.split(':');
          if (id && item) overrides[id] = item;
        });
      }

      const selectedFighters = ids.map(id => {
        const char = characters.find(c => c.id === id);
        if (!char) return null;
        let finalItemId = char.itemId;
        const override = overrides[id];
        if (override === 'none') finalItemId = undefined;
        else if (override) finalItemId = override;
        return { ...char, itemId: finalItemId };
      }).filter(Boolean);

      if (selectedFighters.length < 2) {
        router.push('/');
        return;
      }
      setFighters(selectedFighters as any[]);
    }
  }, [isLoaded, settingsLoaded, itemsLoaded, characters, searchParams, router, playersParam]);

  const startFight = async () => {
    if (fighters.length < 2) return;
    setIsFighting(true);
    setBattleLog('');
    setEpilogueLog('');
    setIsFinished(false);
    setWinner(null);
    localStorage.removeItem(storageKey);

    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          players: fighters.map(f => ({ ...f, itemDetails: items.find(i => i.id === f.itemId) })),
          systemPrompt: settings.systemPrompt,
          model: settings.model,
          temperature: settings.temperature,
          showThinking: settings.showThinking,
          thinkingBudget: settings.thinkingBudget,
          thinkingLevel: settings.thinkingLevel,
          provider: settings.provider
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        setBattleLog(`Error: ${errData.error}`);
        setIsFighting(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let streamText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamText += decoder.decode(value, { stream: true });
        setBattleLog(streamText);
      }

      setIsFighting(false);
      setIsFinished(true);

      let matchWinner = null;
      try {
        const match = streamText.match(/勝者[:：]\s*(.+)/);
        if (match && match[1]) {
          matchWinner = match[1].trim();
          setWinner(matchWinner);
        }
      } catch (e) {
        console.error('Winner detection error:', e);
      }

      if (user?.id) {
        const fIds = fighters.filter(f => f && f.id).map(f => f.id);
        
        // Attempt to save. If it fails, we'll log it.
        const historyData: any = {
          user_id: user.id,
          p1_id: fighters[0]?.id || null,
          p2_id: fighters[1]?.id || null,
          p1_item_id: fighters[0]?.itemId || null,
          p2_item_id: fighters[1]?.itemId || null,
          winner_name: matchWinner,
          log_text: streamText,
          created_at: Date.now()
        };

        // Only add participant_ids if we suspect it might exist, 
        // but since we know it might fail, we'll try-catch or check schema.
        // For now, let's include it and handle the error.
        historyData.participant_ids = fIds;

        const { error: histError } = await supabase.from('battle_history').insert(historyData);
        
        if (histError) {
          console.error('History Save Error (First Attempt):', histError);
          
          // Fallback: If participant_ids is missing, try without it
          if (histError.message.includes('column') && histError.message.includes('participant_ids')) {
            const { participant_ids, ...fallbackData } = historyData;
            const { error: fallbackError } = await supabase.from('battle_history').insert(fallbackData);
            if (fallbackError) {
              console.error('History Save Error (Fallback):', fallbackError);
              alert('Failed to save history: ' + fallbackError.message);
            } else {
              console.log('History saved via fallback (without participant_ids)');
            }
          } else {
            alert('Failed to save history: ' + histError.message);
          }
        } else {
          console.log('History saved successfully');
        }
      }
    } catch (error: any) {
      setBattleLog(`Error: ${error.message}`);
      setIsFighting(false);
    }
  };

  const startEpilogue = async () => {
    if (!battleLog || isFighting || isEpiloguing) return;
    setIsEpiloguing(true);
    setEpilogueLog('');

    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          players: fighters.map(f => ({ ...f, itemDetails: items.find(i => i.id === f.itemId) })),
          systemPrompt: settings.epiloguePrompt,
          model: settings.model,
          temperature: settings.temperature,
          showThinking: settings.showThinking,
          thinkingBudget: settings.thinkingBudget,
          thinkingLevel: settings.thinkingLevel,
          provider: settings.provider,
          isEpilogue: true,
          context: battleLog
        })
      });

      if (!res.ok) throw new Error('Failed to generate epilogue');

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let streamText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamText += decoder.decode(value, { stream: true });
        setEpilogueLog(streamText);
      }
    } catch (error: any) {
      setEpilogueLog(`Error: ${error.message}`);
    } finally {
      setIsEpiloguing(false);
    }
  };

  const renderLog = (logText: string, label?: string) => {
    const findTags = (text: string) => {
      const standardStart = text.indexOf('<think>');
      const gemmaStart = text.indexOf('<|channel>thought');
      if (standardStart !== -1 && (gemmaStart === -1 || standardStart < gemmaStart)) {
        return { start: standardStart, endTag: '</think>', offset: 7 };
      }
      if (gemmaStart !== -1) {
        return { start: gemmaStart, endTag: '<channel|>', offset: 17 };
      }
      return null;
    };

    const tagInfo = findTags(logText);
    if (!tagInfo) return <span>{logText}</span>;

    const before = logText.substring(0, tagInfo.start);
    const afterStart = logText.substring(tagInfo.start + tagInfo.offset);
    const closeIndex = afterStart.indexOf(tagInfo.endTag);

    if (closeIndex === -1) {
      return (
        <span>
          {before}
          <div className={styles.thinkingBox}>
            <div className={styles.thinkingHeader}>💭 Thinking... {label}</div>
            {afterStart}
          </div>
        </span>
      );
    } else {
      const thinkContent = afterStart.substring(0, closeIndex);
      const restContent = afterStart.substring(closeIndex + tagInfo.endTag.length);
      return (
        <span>
          {before}
          <div className={styles.thinkingBox}>
            <div className={styles.thinkingHeader}>💭 Thoughts {label}</div>
            {thinkContent}
          </div>
          {renderLog(restContent, label)}
        </span>
      );
    }
  };

  if (fighters.length === 0) return <div className={styles.container}>Loading Arena...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Button variant="secondary" onClick={() => router.push('/')}>Back</Button>
        <h1 className={styles.title}>Battle Arena</h1>
      </header>

      <div className={styles.arena} style={{ gridTemplateColumns: fighters.length > 2 ? 'repeat(auto-fit, minmax(150px, 1fr))' : '1fr auto 1fr', gap: '1rem' }}>
        {fighters.map((f, i) => (
          <div key={f.id} className={styles.fighter} style={{ borderBottom: `4px solid ${f.color}` }}>
            <div className={styles.fighterName}>{f.name}</div>
            {f.itemId && <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Equip: {items.find(it => it.id === f.itemId)?.name}</div>}
          </div>
        ))}
        {fighters.length <= 2 && (
          <div className={styles.vsContainer} style={{ order: 0 }}>
             <div>VS</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0', gap: '1rem' }}>
        {!isFighting && !isFinished && <Button onClick={startFight}>FIGHT</Button>}
        {isFinished && (
          <>
            <Button variant="secondary" onClick={startFight}>Rematch</Button>
            {!epilogueLog && !isEpiloguing && <Button onClick={startEpilogue}>Generate Epilogue</Button>}
          </>
        )}
      </div>

      {(isFighting || isFinished) && (
        <div className={styles.battleLog}>
          {isFighting && !battleLog && <div className={styles.loadingState}>Generating battle...</div>}
          {renderLog(battleLog)}
          {isFinished && winner && (
            <div className={styles.winnerDeclaration}> Winner: {winner} </div>
          )}

          {epilogueLog && (
            <div className={styles.epilogueArea}>
              <h2 className={styles.epilogueTitle}>❧ Epilogue (後日譚)</h2>
              {renderLog(epilogueLog, '(Epilogue)')}
            </div>
          )}
          {isEpiloguing && !epilogueLog && <div className={styles.loadingState}>Writing epilogue...</div>}
        </div>
      )}
    </div>
  );
}

export default function BattlePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BattleArena />
    </Suspense>
  );
}
