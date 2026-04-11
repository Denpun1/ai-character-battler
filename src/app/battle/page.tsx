"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/Button';
import styles from './page.module.css';

function BattleArena() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, isLoaded } = useCharacters();
  const { items, isLoaded: itemsLoaded } = useItems();
  const { settings, isLoaded: settingsLoaded } = useSettings();

  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [battleLog, setBattleLog] = useState<string>('');
  const [isFighting, setIsFighting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && settingsLoaded && itemsLoaded) {
      const id1 = searchParams.get('p1');
      const id2 = searchParams.get('p2');
      const fighter1 = characters.find(c => c.id === id1);
      const fighter2 = characters.find(c => c.id === id2);

      if (!fighter1 || !fighter2) {
        router.push('/');
        return;
      }
      setP1(fighter1);
      setP2(fighter2);
    }
  }, [isLoaded, settingsLoaded, itemsLoaded, characters, searchParams, router]);

  const startFight = async () => {
    if (!p1 || !p2) return;
    setIsFighting(true);
    setBattleLog('');
    setIsFinished(false);
    setWinner(null);

    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          p1: { ...p1, itemDetails: items.find(i => i.id === p1.itemId) },
          p2: { ...p2, itemDetails: items.find(i => i.id === p2.itemId) },
          systemPrompt: settings.systemPrompt,
          model: settings.model,
          temperature: settings.temperature,
          showThinking: settings.showThinking
        })
      });

      if (!res.ok) {
        let msg = 'Server error';
        try {
          const errData = await res.json();
          msg = errData.error || msg;
        } catch (e) {}
        setBattleLog(`Error: ${msg}`);
        setIsFighting(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsFighting(false);
        return;
      }

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

      const match = streamText.match(/勝者[:：]\s*(.+)/);
      if (match && match[1]) {
        setWinner(match[1].trim());
      }
    } catch (error: any) {
      console.error(error);
      setBattleLog(`Error starting fight: ${error.message || error}`);
      setIsFighting(false);
    }
  };

  const renderLog = (logText: string) => {
    if (!logText.includes('<think>')) return <span>{logText}</span>;

    const parts = logText.split('<think>');
    return (
      <span>
        {parts.map((part, index) => {
          if (index === 0) return <span key={index}>{part}</span>;
          
          const closeIndex = part.indexOf('</think>');
          if (closeIndex === -1) {
            return (
              <div key={index} className={styles.thinkingBox}>
                <div className={styles.thinkingHeader}>💭 AI is thinking...</div>
                {part}
              </div>
            );
          } else {
            const thinkContent = part.substring(0, closeIndex);
            const restContent = part.substring(closeIndex + 8); // length of </think>
            return (
              <span key={index}>
                <div className={styles.thinkingBox}>
                  <div className={styles.thinkingHeader}>💭 Thought Process</div>
                  {thinkContent}
                </div>
                {restContent}
              </span>
            );
          }
        })}
      </span>
    );
  };

  if (!p1 || !p2) return <div className={styles.container}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Button variant="secondary" onClick={() => router.push('/')}>
          Back
        </Button>
        <h1 className={styles.title}>Battle Arena</h1>
      </header>

      <div className={styles.arena}>
        <div className={styles.fighter}>
          <div className={styles.fighterName}>{p1.name}</div>
          {p1.itemId && items.find(i => i.id === p1.itemId) && (
            <div className={styles.fighterItem}>Equipment: {items.find(i => i.id === p1.itemId)?.name}</div>
          )}
        </div>

        <div className={styles.vsContainer}>
          <div>VS</div>
          {!isFighting && !isFinished && (
            <Button onClick={startFight} style={{ marginTop: '1rem' }}>FIGHT</Button>
          )}
          {!isFighting && isFinished && (
            <Button variant="secondary" onClick={startFight} style={{ marginTop: '1rem' }}>Rematch</Button>
          )}
        </div>

        <div className={styles.fighter}>
          <div className={styles.fighterName}>{p2.name}</div>
          {p2.itemId && items.find(i => i.id === p2.itemId) && (
            <div className={styles.fighterItem}>Equipment: {items.find(i => i.id === p2.itemId)?.name}</div>
          )}
        </div>
      </div>

      {(isFighting || isFinished) && (
        <div className={styles.battleLog}>
          {isFighting && !battleLog && (
            <div className={styles.loadingState}>
              Generating battle...
            </div>
          )}
          {renderLog(battleLog)}
          
          {isFinished && winner && (
            <div className={styles.winnerDeclaration}>
              Winner: {winner}
            </div>
          )}
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
