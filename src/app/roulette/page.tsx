"use client";

import { useState, useRef } from 'react';
import { useRoulettes, RouletteItem } from '@/hooks/useRoulettes';
import { RouletteWheel, RouletteWheelRef } from '@/components/RouletteWheel';
import { Button } from '@/components/Button';
import styles from './page.module.css';

const DEFAULT_ITEMS: RouletteItem[] = [
  { id: '1', label: 'Option A', color: '#ef4444', weight: 1 },
  { id: '2', label: 'Option B', color: '#3b82f6', weight: 1 },
  { id: '3', label: 'Option C', color: '#10b981', weight: 1 },
  { id: '4', label: 'Option D', color: '#eab308', weight: 1 },
];

export default function RoulettePage() {
  const { presets, savePreset, deletePreset, isLoaded } = useRoulettes();
  const [items, setItems] = useState<RouletteItem[]>(DEFAULT_ITEMS);
  const [wheelCount, setWheelCount] = useState(1);
  const [history, setHistory] = useState<{ id: string; time: string; label: string; wheelIdx: number }[]>([]);
  const [presetName, setPresetName] = useState('');

  // We need refs to access the spin method of multiple wheels
  const wheelRefs = useRef<{ [key: number]: RouletteWheelRef | null }>({});

  const handleAddItem = () => {
    // Generate a random bright color
    const hue = Math.floor(Math.random() * 360);
    const color = `hsl(${hue}, 70%, 50%)`;
    setItems([...items, { id: crypto.randomUUID(), label: `New Option`, color, weight: 1 }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleChangeItem = (id: string, field: keyof RouletteItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const spinAll = () => {
    for (let i = 0; i < wheelCount; i++) {
      if (wheelRefs.current[i]) {
        // slightly stagger the spins to avoid synchronized stopping if velocity is similar
        setTimeout(() => {
          wheelRefs.current[i]?.spin();
        }, i * 150);
      }
    }
  };

  const handleSpinEnd = (winner: RouletteItem, wheelIdx: number) => {
    setHistory(prev => [{
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      label: winner.label,
      wheelIdx
    }, ...prev]);
  };

  const loadPreset = (presetId: string) => {
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setItems(p.items);
    }
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName, items);
    setPresetName('');
  };

  if (!isLoaded) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Premium Roulette</h1>
      </header>

      <div className={styles.mainGrid}>
        
        {/* Controls Panel */}
        <div className={`${styles.glassPanel} ${styles.controlsPanel}`}>
          <h2 style={{ marginBottom: '1rem' }}>Configuration</h2>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              Wheels: 
              <input 
                type="number" 
                min="1" max="4" 
                value={wheelCount} 
                onChange={(e) => setWheelCount(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))} 
                className={styles.itemInput}
                style={{ width: '60px' }}
              />
            </label>
            <Button onClick={spinAll} style={{ flex: 1 }}>SPIN ALL</Button>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3>Items List</h3>
            <Button variant="secondary" onClick={handleAddItem} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>+ Add</Button>
          </div>
          
          <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {items.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <input 
                  type="color" 
                  value={item.color.startsWith('hsl') ? '#ffffff' : item.color} // Simplistic color handle unless hex
                  onChange={e => handleChangeItem(item.id, 'color', e.target.value)} 
                  className={styles.colorPicker}
                />
                <input 
                  type="text" 
                  value={item.label} 
                  onChange={e => handleChangeItem(item.id, 'label', e.target.value)} 
                  className={styles.itemInput}
                  style={{ flex: 1 }}
                />
                <input 
                  type="number" 
                  min="1"
                  value={item.weight} 
                  onChange={e => handleChangeItem(item.id, 'weight', parseInt(e.target.value) || 1)} 
                  className={`${styles.itemInput} ${styles.weightInput}`}
                  title="Weight"
                />
                <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'transparent', border: 'none', color: '#ff5555', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }} />

          <h3>Presets</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select className={styles.itemInput} style={{ flex: 1 }} onChange={e => loadPreset(e.target.value)} defaultValue="">
              <option value="" disabled>Load preset...</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className={styles.itemInput} 
              style={{ flex: 1 }} 
              placeholder="Preset name..." 
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
            />
            <Button variant="secondary" onClick={handleSavePreset} disabled={!presetName.trim()}>Save</Button>
          </div>
        </div>

        {/* Wheels Area */}
        <div className={styles.wheelsContainer}>
          {Array.from({ length: wheelCount }).map((_, idx) => (
            <div key={idx} className={`${styles.glassPanel} ${styles.wheelWrapper}`}>
              <h3 style={{ textTransform: 'uppercase', letterSpacing: '2px', color: '#aaa', fontSize: '0.9rem' }}>Wheel {idx + 1}</h3>
              <RouletteWheel 
                ref={(el) => { wheelRefs.current[idx] = el; }}
                items={items} 
                onSpinEnd={(winner) => handleSpinEnd(winner, idx + 1)}
              />
              <Button onClick={() => wheelRefs.current[idx]?.spin()} style={{ width: '80%' }}>SPIN</Button>
            </div>
          ))}
        </div>

        {/* History Panel */}
        <div className={`${styles.glassPanel} ${styles.historyPanel}`}>
          <h2 style={{ marginBottom: '1rem' }}>Spin History</h2>
          {history.length === 0 ? (
            <div style={{ color: '#888', fontSize: '0.9rem' }}>No spins yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map(item => (
                <div key={item.id} className={styles.historyItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>W{item.wheelIdx}</span>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
