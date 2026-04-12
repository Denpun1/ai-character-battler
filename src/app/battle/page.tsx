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
    // 1. Unified function to handle both <think> and Gemma-style tags
    const findTags = (text: string) => {
      // Look for standard <think> or Gemma <|channel>thought
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
            <div className={styles.thinkingHeader}>💭 AI is thinking...</div>
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
            <div className={styles.thinkingHeader}>💭 Thought Process</div>
            {thinkContent}
          </div>
          {renderLog(restContent)}
        </span>
      );
    }
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
