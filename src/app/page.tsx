"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import styles from './page.module.css';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

export default function Home() {
  const router = useRouter();
  const { characters, isLoaded: charLoaded, addCharacter, editCharacter, deleteCharacter } = useCharacters();
  const { items, isLoaded: itemsLoaded, addItem, editItem, deleteItem } = useItems();
  const { settings, isLoaded: settingsLoaded, saveSettings } = useSettings();
  const { isSignedIn, isLoaded: isAuthLoaded } = useUser();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals state
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // Character Form
  const [charName, setCharName] = useState('');
  const [charSkills, setCharSkills] = useState('');
  const [charItemId, setCharItemId] = useState('');
  const [charColor, setCharColor] = useState(COLORS[0]);

  // Item Form
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  // Settings Form
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [provider, setProvider] = useState<'google' | 'lightning'>('google');

  const handleSelectChar = (id: string) => {
    setSelectedIds(prev => {
      if (prev.length < 2) {
        return [...prev, id]; // Allow duplicates
      }
      // If 2 already selected, replace the oldest one
      return [prev[1], id];
    });
  };

  const openCharModal = (id?: string) => {
    if (id) {
      const char = characters.find(c => c.id === id);
      if (char) {
        setEditingCharId(id);
        setCharName(char.name);
        setCharSkills(char.skills);
        setCharItemId(char.itemId || '');
        setCharColor(char.color || COLORS[0]);
      }
    } else {
      setEditingCharId(null);
      setCharName('');
      setCharSkills('');
      setCharItemId('');
      setCharColor(COLORS[0]);
    }
    setIsCharModalOpen(true);
  };

  const saveChar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !charSkills.trim()) return;
    
    if (editingCharId) {
      editCharacter(editingCharId, charName.trim(), charSkills.trim(), charItemId, charColor);
    } else {
      addCharacter(charName.trim(), charSkills.trim(), charItemId, charColor);
    }
    setIsCharModalOpen(false);
  };

  const openItemModal = (id?: string) => {
    if (id) {
      const item = items.find(i => i.id === id);
      if (item) {
        setEditingItemId(id);
        setItemName(item.name);
        setItemDesc(item.description);
      }
    } else {
      setEditingItemId(null);
      setItemName('');
      setItemDesc('');
    }
    setIsItemModalOpen(true);
  };

  const saveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemDesc.trim()) return;
    
    if (editingItemId) {
      editItem(editingItemId, itemName.trim(), itemDesc.trim());
    } else {
      addItem(itemName.trim(), itemDesc.trim());
    }
    setIsItemModalOpen(false);
  };

  const openSettings = () => {
    setSystemPrompt(settings.systemPrompt);
    setModel(settings.model);
    setTemperature(settings.temperature);
    setShowThinking(settings.showThinking || false);
    setThinkingBudget(settings.thinkingBudget || 0);
    setProvider(settings.provider || 'google');
    setIsSettingsOpen(true);
  };

  const saveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ systemPrompt, model, temperature, showThinking, thinkingBudget, provider });
    setIsSettingsOpen(false);
  };

  const startBattle = () => {
    if (selectedIds.length !== 2) return;
    router.push(`/battle?p1=${selectedIds[0]}&p2=${selectedIds[1]}`);
  };

  if (!charLoaded || !itemsLoaded || !settingsLoaded || !isAuthLoaded) return <div>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Character Battler</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Button variant="secondary" onClick={openSettings}>Settings</Button>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <Button>Login</Button>
            </SignInButton>
          ) : (
            <UserButton />
          )}
        </div>
      </header>

      {/* Characters Section */}
      <div className={styles.rosterSection} style={{ marginBottom: '3rem' }}>
        <div className={styles.rosterHeader}>
          <h2>Characters</h2>
          <Button onClick={() => openCharModal()}>
            New Character
          </Button>
        </div>

        {characters.length === 0 ? (
          <div className={styles.emptyState}>No characters. Create some to start.</div>
        ) : (
          <div className={styles.grid}>
            {characters.map(char => {
              const equippedItem = char.itemId ? items.find(i => i.id === char.itemId) : null;
              return (
                <Card 
                  key={char.id} 
                  className={styles.characterCard}
                  selected={selectedIds.includes(char.id)}
                  onClick={() => handleSelectChar(char.id)}
                >
                  <div className={styles.characterName}>
                    <span style={{ color: char.color, marginRight: '8px' }}>●</span>
                    {char.name}
                  </div>
                  {equippedItem && (
                    <div className={styles.characterItem}>
                      Item: {equippedItem.name}
                    </div>
                  )}
                  <div className={styles.characterSkills}>
                    {char.skills.length > 80 ? `${char.skills.substring(0, 80)}...` : char.skills}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', alignSelf: 'flex-end' }}>
                    <button 
                      className={styles.deleteBtn}
                      style={{ color: 'var(--foreground)' }}
                      onClick={(e) => { e.stopPropagation(); openCharModal(char.id); }}
                    >
                      Edit
                    </button>
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
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Items Section */}
      <div className={styles.rosterSection}>
        <div className={styles.rosterHeader}>
          <h2>Items</h2>
          <Button onClick={() => openItemModal()}>
            New Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className={styles.emptyState}>No items. Create some to equip on characters.</div>
        ) : (
          <div className={styles.grid}>
            {items.map(it => (
              <Card key={it.id} className={styles.characterCard}>
                <div className={styles.characterName}>{it.name}</div>
                <div className={styles.characterSkills}>{it.description}</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', alignSelf: 'flex-end' }}>
                  <button 
                    className={styles.deleteBtn}
                    style={{ color: 'var(--foreground)' }}
                    onClick={() => openItemModal(it.id)}
                  >
                    Edit
                  </button>
                  <button 
                    className={styles.deleteBtn}
                    onClick={() => deleteItem(it.id)}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(selectedIds.length > 0) && (
        <div className={styles.battleControls}>
          <div className={styles.selectedFighters} style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
            <div>
              <strong>Player 1:</strong> {characters.find(c => c.id === selectedIds[0])?.name || '(Not selected)'}
              {selectedIds[0] && <button style={{ marginLeft: '1rem' }} onClick={() => setSelectedIds(prev => prev.length === 2 ? [prev[1]] : [])}>✕</button>}
            </div>
            <div>
              <strong>Player 2:</strong> {characters.find(c => c.id === selectedIds[1])?.name || '(Not selected)'}
              {selectedIds[1] && <button style={{ marginLeft: '1rem' }} onClick={() => setSelectedIds(prev => [prev[0]])}>✕</button>}
            </div>
          </div>
          <Button onClick={startBattle} disabled={selectedIds.length !== 2}>
            Start Battle
          </Button>
        </div>
      )}

      {/* Character Modal */}
      {isCharModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{editingCharId ? 'Edit Character' : 'Create New Character'}</h2>
            <form onSubmit={saveChar}>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input type="text" value={charName} onChange={e => setCharName(e.target.value)} className={styles.input} required />
              </div>
              <div className={styles.formGroup}>
                <label>Description / 設定・特徴</label>
                <textarea value={charSkills} onChange={e => setCharSkills(e.target.value)} className={styles.textarea} required />
              </div>
              <div className={styles.formGroup}>
                <label>Item / Equipment</label>
                <select value={charItemId} onChange={e => setCharItemId(e.target.value)} className={styles.input}>
                  <option value="">-- None --</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {COLORS.map(c => (
                    <div
                      key={c} onClick={() => setCharColor(c)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c,
                        border: charColor === c ? '2px solid var(--foreground)' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsCharModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{editingItemId ? 'Edit Item' : 'Create New Item'}</h2>
            <form onSubmit={saveItem}>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className={styles.input} required />
              </div>
              <div className={styles.formGroup}>
                <label>Description / Effect</label>
                <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className={styles.textarea} required />
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
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
                <label>API Provider</label>
                <select value={provider} onChange={e => setProvider(e.target.value as any)} className={styles.input}>
                  <option value="google">Google AI Studio (Gemini)</option>
                  <option value="lightning">Lightning AI (Gemma/Llama)</option>
                </select>
              </div>
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
                  <option value="gemma-4-31b-it" />
                  <option value="gemini-1.5-pro" />
                  <option value="gemini-1.5-flash" />
                  <option value="gemma-2-27b-it" />
                </datalist>
              </div>
              <div className={styles.formGroup}>
                <label>Thinking Level (Temperature)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input 
                    type="range" 
                    min="0" max="2" step="0.1" 
                    value={temperature} 
                    onChange={e => setTemperature(parseFloat(e.target.value))} 
                    style={{ flex: 1 }}
                  />
                  <span>{temperature}</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>System Prompt</label>
                <textarea 
                  value={systemPrompt} 
                  onChange={e => setSystemPrompt(e.target.value)} 
                  className={styles.textarea}
                  style={{ minHeight: '150px' }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Thinking Budget (Tokens) - Gemini専用</label>
                <input 
                  type="number" 
                  value={thinkingBudget} 
                  onChange={e => setThinkingBudget(parseInt(e.target.value) || 0)} 
                  className={styles.input}
                  placeholder="例: 24000 (0で無効)"
                />
                <small style={{ color: '#888' }}>※Gemini 2.x以降のThinkingモデルで使用。整数である必要があります。</small>
              </div>
              <div className={styles.formGroup}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={showThinking} 
                    onChange={e => setShowThinking(e.target.checked)} 
                  />
                  AIの思考プロセスを表示する（ストリーミング出力）
                </label>
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
