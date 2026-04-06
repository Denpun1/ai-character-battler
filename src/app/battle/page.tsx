"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/Button';
import styles from './page.module.css';

function BattleArena() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, isLoaded } = useCharacters();
  const { settings, isLoaded: settingsLoaded } = useSettings();

  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [battleLog, setBattleLog] = useState<string>('');
  const [isFighting, setIsFighting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && settingsLoaded) {
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
  }, [isLoaded, settingsLoaded, characters, searchParams, router]);

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
          p1, 
          p2,
          systemPrompt: settings.systemPrompt,
          model: settings.model
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setBattleLog(`Error: ${data.error}`);
        setIsFighting(false);
        return;
      }

      const text = data.result;
      let currentIndex = 0;
      let currentFormat = '';
      
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          currentFormat += text[currentIndex];
          setBattleLog(currentFormat);
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsFighting(false);
          setIsFinished(true);

          const match = text.match(/勝者[:：]\s*(.+)/);
          if (match && match[1]) {
            setWinner(match[1].trim());
          }
        }
      }, 15);

    } catch (error) {
      console.error(error);
      setBattleLog("Error starting fight");
      setIsFighting(false);
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
          {p1.item && <div className={styles.fighterItem}>Item: {p1.item}</div>}
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
          {p2.item && <div className={styles.fighterItem}>Item: {p2.item}</div>}
        </div>
      </div>

      {(isFighting || isFinished) && (
        <div className={styles.battleLog}>
          {isFighting && !battleLog && (
            <div className={styles.loadingState}>
              Generating battle...
            </div>
          )}
          {battleLog}
          
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
