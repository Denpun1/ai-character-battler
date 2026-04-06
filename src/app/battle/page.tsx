"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { Button } from '@/components/Button';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import styles from './page.module.css';

function BattleArena() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, isLoaded } = useCharacters();

  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [battleLog, setBattleLog] = useState<string>('');
  const [isFighting, setIsFighting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  // Animation states
  const [animP1, setAnimP1] = useState('');
  const [animP2, setAnimP2] = useState('');

  useEffect(() => {
    if (isLoaded) {
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
  }, [isLoaded, characters, searchParams, router]);

  const triggerAnim = (target: 'p1' | 'p2', action: 'attack' | 'hurt') => {
    if (target === 'p1') {
      setAnimP1(action === 'attack' ? styles.attackingRight : styles.hurting);
      setTimeout(() => setAnimP1(''), 500);
    } else {
      setAnimP2(action === 'attack' ? styles.attackingLeft : styles.hurting);
      setTimeout(() => setAnimP2(''), 500);
    }
  };

  const startFight = async () => {
    if (!p1 || !p2) return;
    setIsFighting(true);
    setBattleLog('');
    setIsFinished(false);
    setWinner(null);

    // Initial attacks
    triggerAnim('p1', 'attack');
    setTimeout(() => triggerAnim('p2', 'hurt'), 250);

    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p1, p2 })
      });

      const data = await res.json();

      if (!res.ok) {
        setBattleLog(`Error: ${data.error}`);
        setIsFighting(false);
        return;
      }

      // Typewriter effect
      const text = data.result;
      let currentIndex = 0;
      let currentFormat = '';
      
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          currentFormat += text[currentIndex];
          setBattleLog(currentFormat);
          
          // Randomly trigger animations during generation
          if (currentIndex % 50 === 0 && Math.random() > 0.5) {
            const attacker = Math.random() > 0.5 ? 'p1' : 'p2';
            const defender = attacker === 'p1' ? 'p2' : 'p1';
            triggerAnim(attacker, 'attack');
            setTimeout(() => triggerAnim(defender, 'hurt'), 250);
          }
          
          currentIndex++;
        } else {
          clearInterval(interval);
          setIsFighting(false);
          setIsFinished(true);

          // Extract winner
          const match = text.match(/勝者[:：]\s*(.+)/);
          if (match && match[1]) {
            setWinner(match[1].trim());
          }
        }
      }, 30); // 30ms per char

    } catch (error) {
      console.error(error);
      setBattleLog("Failed to simulate battle.");
      setIsFighting(false);
    }
  };

  if (!p1 || !p2) return <div className={styles.container}>Loading arena...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Button variant="secondary" onClick={() => router.push('/')}>
          <ArrowLeft size={18} /> Back
        </Button>
        <h1 className={styles.title}>BATTLE ARENA</h1>
      </header>

      <div className={styles.arena}>
        {/* Fighter 1 */}
        <div className={styles.fighter}>
          <div 
            className={`${styles.avatar} ${animP1}`}
            style={{ backgroundColor: p1.color || 'var(--primary)' }}
          >
            {p1.name.substring(0, 2).toUpperCase()}
          </div>
          <div className={styles.fighterInfo}>
            <div className={styles.fighterName}>{p1.name}</div>
          </div>
        </div>

        <div className={styles.vsContainer}>
          <div className={styles.vsText}>VS</div>
          {!isFighting && !isFinished && (
            <Button onClick={startFight} style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}>
              <PlayCircle size={24} style={{ marginRight: '8px' }} /> FIGHT!
            </Button>
          )}
          {!isFighting && isFinished && (
            <Button onClick={startFight} variant="secondary">
              Rematch
            </Button>
          )}
        </div>

        {/* Fighter 2 */}
        <div className={styles.fighter}>
          <div 
            className={`${styles.avatar} ${animP2}`}
            style={{ backgroundColor: p2.color || 'var(--accent)' }}
          >
            {p2.name.substring(0, 2).toUpperCase()}
          </div>
          <div className={styles.fighterInfo}>
            <div className={styles.fighterName}>{p2.name}</div>
          </div>
        </div>
      </div>

      {(isFighting || isFinished) && (
        <div className={styles.battleLog}>
          {isFighting && !battleLog && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              AI is writing the battle scenario...
            </div>
          )}
          {battleLog}
          
          {isFinished && winner && (
            <div className={styles.winnerDeclaration}>
              🏆 THE WINNER IS {winner.toUpperCase()}! 🏆
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BattlePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <BattleArena />
    </Suspense>
  );
}
