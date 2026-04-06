"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Plus, Swords, Trash2, X } from 'lucide-react';
import styles from './page.module.css';

const COLORS = ['#4F46E5', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function Home() {
  const router = useRouter();
  const { characters, isLoaded, addCharacter, deleteCharacter } = useCharacters();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      }
      if (prev.length < 2) {
        return [...prev, id];
      }
      // If 2 already selected, replace the second one
      return [prev[0], id];
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !skills.trim()) return;
    
    addCharacter(name.trim(), skills.trim(), color);
    setIsModalOpen(false);
    setName('');
    setSkills('');
    setColor(COLORS[0]);
  };

  const startBattle = () => {
    if (selectedIds.length !== 2) return;
    // Pass IDs via query params to the battle page
    router.push(`/battle?p1=${selectedIds[0]}&p2=${selectedIds[1]}`);
  };

  if (!isLoaded) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Character Battler</h1>
        <p className={styles.subtitle}>Create unique fighters and let Gemini AI decide who wins</p>
      </header>

      <div className={styles.rosterSection}>
        <div className={styles.rosterHeader}>
          <h2>Your Roster</h2>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={20} /> New Character
          </Button>
        </div>

        {characters.length === 0 ? (
          <div className={styles.emptyState}>
            <p>You don't have any characters yet. Create some to start a battle!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {characters.map(char => (
              <Card 
                key={char.id} 
                className={styles.characterCard}
                selected={selectedIds.includes(char.id)}
                onClick={() => handleSelect(char.id)}
              >
                <div className={styles.characterName}>
                  <span className={styles.colorDot} style={{ backgroundColor: char.color || 'var(--primary)' }} />
                  {char.name}
                </div>
                <div className={styles.characterSkills}>
                  {char.skills.length > 100 ? `${char.skills.substring(0, 100)}...` : char.skills}
                </div>
                <button 
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCharacter(char.id);
                    setSelectedIds(prev => prev.filter(id => id !== char.id));
                  }}
                  title="Delete Character"
                >
                  <Trash2 size={18} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className={`${styles.battleControls} ${selectedIds.length === 2 ? styles.visible : ''}`}>
        <div className={styles.selectedFighters}>
          <span>{characters.find(c => c.id === selectedIds[0])?.name}</span>
          <span className={styles.vs}>VS</span>
          <span>{characters.find(c => c.id === selectedIds[1])?.name}</span>
        </div>
        <Button onClick={startBattle} className={styles.fightBtn}>
          <Swords size={20} /> Start Battle
        </Button>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <Card className={styles.modalContent}>
            <div className={styles.rosterHeader}>
              <h2 className={styles.modalTitle}>Create New Character</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={styles.input}
                  placeholder="e.g. Shadow Ninja"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Skills & Description</label>
                <textarea 
                  value={skills} 
                  onChange={e => setSkills(e.target.value)} 
                  className={styles.textarea}
                  placeholder="Describe their abilities, weapons, fighting style, etc..."
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Theme Color</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: color === c ? '2px solid white' : 'none',
                        cursor: 'pointer',
                        boxShadow: color === c ? '0 0 0 2px var(--background)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Character
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
