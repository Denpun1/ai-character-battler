"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useSettings } from '@/hooks/useSettings';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import styles from './page.module.css';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

export default function Home() {
  const router = useRouter();
  const { characters, isLoaded, addCharacter, deleteCharacter } = useCharacters();
  const { settings, isLoaded: settingsLoaded, saveSettings } = useSettings();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Character Form
  const [name, setName] = useState('');
  const [skills, setSkills] = useState('');
  const [item, setItem] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  // Settings Form
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      }
      if (prev.length < 2) {
        return [...prev, id];
      }
      return [prev[0], id];
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !skills.trim()) return;
    
    addCharacter(name.trim(), skills.trim(), item.trim(), color);
    setIsModalOpen(false);
    setName('');
    setSkills('');
    setItem('');
    setColor(COLORS[0]);
  };

  const openSettings = () => {
    setSystemPrompt(settings.systemPrompt);
    setModel(settings.model);
    setIsSettingsOpen(true);
  };

  const saveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ systemPrompt, model });
    setIsSettingsOpen(false);
  };

  const startBattle = () => {
    if (selectedIds.length !== 2) return;
    router.push(`/battle?p1=${selectedIds[0]}&p2=${selectedIds[1]}`);
  };

  if (!isLoaded || !settingsLoaded) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Character Battler</h1>
        <div>
          <Button variant="secondary" onClick={openSettings}>Settings</Button>
        </div>
      </header>

      <div className={styles.rosterSection}>
        <div className={styles.rosterHeader}>
          <h2>Characters</h2>
          <Button onClick={() => setIsModalOpen(true)}>
            New Character
          </Button>
        </div>

        {characters.length === 0 ? (
          <div className={styles.emptyState}>No characters. Create some to start.</div>
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
                  <span style={{ color: char.color, marginRight: '8px' }}>●</span>
                  {char.name}
                </div>
                {char.item && (
                  <div className={styles.characterItem}>
                    Item: {char.item}
                  </div>
                )}
                <div className={styles.characterSkills}>
                  {char.skills.length > 80 ? `${char.skills.substring(0, 80)}...` : char.skills}
                </div>
                <button 
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCharacter(char.id);
                    setSelectedIds(prev => prev.filter(id => id !== char.id));
                  }}
                >
                  Delete
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedIds.length === 2 && (
        <div className={styles.battleControls}>
          <div className={styles.selectedFighters}>
            {characters.find(c => c.id === selectedIds[0])?.name} VS {characters.find(c => c.id === selectedIds[1])?.name}
          </div>
          <Button onClick={startBattle}>
            Start Battle
          </Button>
        </div>
      )}

      {/* Character Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Create New Character</h2>
            <form onSubmit={handleCreate}>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Skills</label>
                <textarea 
                  value={skills} 
                  onChange={e => setSkills(e.target.value)} 
                  className={styles.textarea}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Item / Equipment</label>
                <input 
                  type="text" 
                  value={item} 
                  onChange={e => setItem(e.target.value)} 
                  className={styles.input}
                  placeholder="Optional item"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c,
                        border: color === c ? '2px solid var(--foreground)' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Settings</h2>
            <form onSubmit={saveSettingsForm}>
              <div className={styles.formGroup}>
                <label>Model</label>
                <input 
                  type="text" 
                  list="model-presets"
                  value={model} 
                  onChange={e => setModel(e.target.value)} 
                  className={styles.input}
                  required
                />
                <datalist id="model-presets">
                  <option value="gemini-2.5-flash" />
                  <option value="gemini-1.5-pro" />
                  <option value="gemini-1.5-flash" />
                </datalist>
              </div>
              <div className={styles.formGroup}>
                <label>System Prompt</label>
                <textarea 
                  value={systemPrompt} 
                  onChange={e => setSystemPrompt(e.target.value)} 
                  className={styles.textarea}
                  style={{ minHeight: '200px' }}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Save Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
