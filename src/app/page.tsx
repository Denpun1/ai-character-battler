"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { useBattleRealtime } from '@/hooks/useBattleRealtime'; // Ensure this is imported
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { PluginManager } from '@/components/PluginManager';
import styles from './page.module.css';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

export default function Home() {
  const router = useRouter();
  const { characters, isLoaded: charLoaded, addCharacter, editCharacter, deleteCharacter, fetchVariants, saveVariant, deleteVariant } = useCharacters();
  const { items, isLoaded: itemsLoaded, addItem, editItem, deleteItem } = useItems();
  const { settings, presets, isLoaded: settingsLoaded, saveSettings, createPreset, deletePreset } = useSettings();
  const { isSignedIn, isLoaded: isAuthLoaded, user } = useUser();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemOverrides, setItemOverrides] = useState<Record<string, string>>({}); // { charId: itemId }
  
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
  const [charVariants, setCharVariants] = useState<any[]>([]);
  const [newVariantName, setNewVariantName] = useState('');

  // Item Form
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  // Settings Form
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [thinkingLevel, setThinkingLevel] = useState<'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [provider, setProvider] = useState<'google' | 'lightning'>('google');
  const [epiloguePrompt, setEpiloguePrompt] = useState('');
  const [newPresetName, setNewPresetName] = useState('');

  // Plugin System States
  const [battleLog, setBattleLog] = useState<string | null>(null);
  const [pluginLogs, setPluginLogs] = useState<any[]>([]);

  useBattleRealtime();

  useEffect(() => {
    const handleStatusChange = async (e: any) => {
      const data = e.detail;
      if (data.status === 'completed' && data.resultId) {
        const { data: result } = await supabase.from('battle_history').select('*').eq('id', data.resultId).single();
        if (result) {
          setBattleLog(result.log_text);
          window.dispatchEvent(new CustomEvent('plugin:run', { 
            detail: { triggerType: 'end', contextOverride: { battleResult: result } } 
          }));
        }
      }
    };

    const handlePluginUI = (e: any) => {
      setPluginLogs(prev => [...prev, e.detail]);
    };

    window.addEventListener('battleStatusChange', handleStatusChange);
    window.addEventListener('plugin:ui:display', handlePluginUI);
    return () => {
      window.removeEventListener('battleStatusChange', handleStatusChange);
      window.removeEventListener('plugin:ui:display', handlePluginUI);
    };
  }, []);

  const handleSelectChar = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const openCharModal = async (id?: string) => {
    if (id) {
      const char = characters.find(c => c.id === id);
      if (char) {
        setEditingCharId(id);
        setCharName(char.name);
        setCharSkills(char.skills);
        setCharItemId(char.itemId || '');
        setCharColor(char.color || COLORS[0]);
        // Load variants
        const vars = await fetchVariants(id);
        setCharVariants(vars);
      }
    } else {
      setEditingCharId(null);
      setCharName('');
      setCharSkills('');
      setCharItemId('');
      setCharColor(COLORS[0]);
      setCharVariants([]);
    }
    setNewVariantName('');
    setIsCharModalOpen(true);
  };

  const saveChar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !charSkills.trim()) return;
    
    if (editingCharId) {
      await editCharacter(editingCharId, charName.trim(), charSkills.trim(), charItemId, charColor);
    } else {
      await addCharacter(charName.trim(), charSkills.trim(), charItemId, charColor);
    }
    setIsCharModalOpen(false);
  };

  const handleSaveVariant = async () => {
    if (!editingCharId || !newVariantName.trim()) return;
    await saveVariant(editingCharId, newVariantName, charSkills);
    setNewVariantName('');
    const vars = await fetchVariants(editingCharId);
    setCharVariants(vars);
  };

  const loadVariant = (skills: string) => {
    setCharSkills(skills);
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
    setThinkingLevel(settings.thinkingLevel || 'HIGH');
    setEpiloguePrompt(settings.epiloguePrompt || '');
    setProvider(settings.provider || 'google');
    setIsSettingsOpen(true);
  };

  const saveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ systemPrompt, epiloguePrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
    setIsSettingsOpen(false);
  };

  const handleLoadPreset = (presetId: string) => {
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setSystemPrompt(p.systemPrompt);
      setModel(p.model);
      setTemperature(p.temperature);
      setShowThinking(p.showThinking);
      setThinkingBudget(p.thinkingBudget);
      setThinkingLevel(p.thinkingLevel);
      setEpiloguePrompt(p.epiloguePrompt);
      setProvider(p.provider);
    }
  };

  const handleSaveNewPreset = () => {
    if (!newPresetName.trim()) return;
    createPreset(newPresetName, { systemPrompt, epiloguePrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
    setNewPresetName('');
  };

  const startBattle = async () => {
    if (selectedIds.length < 2 || !user) return;

    try {
      // 1. Insert into Queue
      const { data, error } = await supabase.from('battle_queue').insert({
        user_id: user.id,
        p1_id: selectedIds[0],
        p2_id: selectedIds[1],
        participant_ids: selectedIds,
        system_prompt: systemPrompt,
        epilogue_prompt: epiloguePrompt,
        model: model,
        temperature: temperature,
        provider: provider,
        status: 'pending',
        created_at: Date.now()
      }).select('id').single();

      if (error) throw error;

      // 2. Trigger the rebuilt processor
      // We don't await this, as the UI will handle updates via Realtime
      fetch('/api/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: data.id, userId: user.id })
      }).catch(err => console.error('[Queue Trigger Error]', err));

    } catch (err: any) {
      alert('対戦の開始に失敗しました: ' + err.message);
    }
  };


  if (!charLoaded || !itemsLoaded || !settingsLoaded || !isAuthLoaded) return <div>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome to the Arena</h1>
        <div>
          <Button variant="secondary" onClick={openSettings}>Settings (Presets)</Button>
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
          <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Selected Fighters ({selectedIds.length})</h3>
          <div className={styles.selectedFighters} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            {selectedIds.map((id, index) => {
              const char = characters.find(c => c.id === id);
              if (!char) return null;
              return (
                <div key={id} style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  borderLeft: `4px solid ${char.color}`,
                  padding: '1rem',
                  borderRadius: '8px',
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  position: 'relative'
                }}>
                  <button 
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'transparent', border: 'none', color: '#ff5555', cursor: 'pointer' }} 
                    onClick={() => handleSelectChar(id)}
                  >✕</button>
                  <div>
                    <strong>P{index + 1}:</strong> {char.name}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <label>Item: </label>
                    <select 
                      value={itemOverrides[id] || ''} 
                      onChange={e => setItemOverrides(prev => ({ ...prev, [id]: e.target.value }))}
                      className={styles.input}
                      style={{ padding: '0.2rem', marginTop: '4px', width: '100%' }}
                    >
                      <option value="">-- Permanent --</option>
                      <option value="none">-- Forced None --</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button onClick={startBattle} disabled={selectedIds.length < 2}>
              Start {selectedIds.length}-Way Battle
            </Button>
          </div>
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
                <Button type="submit">Save (Changes will backup)</Button>
              </div>

              {editingCharId && (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📜 History & Variants</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input 
                      type="text" 
                      value={newVariantName} 
                      onChange={e => setNewVariantName(e.target.value)} 
                      className={styles.input} 
                      placeholder="Variant name to save current text..."
                    />
                    <Button type="button" variant="secondary" onClick={handleSaveVariant} disabled={!newVariantName.trim()}>Save as Variant</Button>
                  </div>
                  
                  <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {charVariants.map(v => (
                      <div key={v.id} style={{ padding: '0.5rem', background: 'var(--border)', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong>{v.isBackup ? '🕒 Auto-Backup' : `⭐ ${v.name}`}</strong>
                          <span>{new Date(v.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '8px', color: '#666' }}>
                          {v.skills}
                        </div>
                        <Button type="button" variant="secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => loadVariant(v.skills)}>
                          Restore this text
                        </Button>
                      </div>
                    ))}
                    {charVariants.length === 0 && <div style={{ color: '#888', fontSize: '0.85rem' }}>No history or variants yet.</div>}
                  </div>
                </div>
              )}
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
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <h2 className={styles.modalTitle}>Settings</h2>

            <div className={styles.formGroup}>
              <label>📁 Load Saved Instruction (Preset)</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    className={styles.input} 
                    onChange={e => handleLoadPreset(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>-- Select instruction to load --</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {presets.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                      <span style={{ marginRight: '0.5rem' }}>{p.name}</span>
                      <button 
                        onClick={() => deletePreset(p.id)}
                        style={{ background: 'none', border: 'none', color: '#ff5555', cursor: 'pointer', padding: '0 2px' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

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
                <label>Thinking Budget (Tokens) - Gemini 2.x専用</label>
                <input 
                  type="number" 
                  value={thinkingBudget} 
                  onChange={e => setThinkingBudget(parseInt(e.target.value) || 0)} 
                  className={styles.input}
                  placeholder="例: 24000 (0で無効)"
                />
                <small style={{ color: '#888' }}>※Gemini 2.x以降のThinkingモデルで使用。</small>
              </div>
              <div className={styles.formGroup}>
                <label>Thinking Level - Gemma 4 / Gemini 3専用</label>
                <select 
                  value={thinkingLevel} 
                  onChange={e => setThinkingLevel(e.target.value as any)} 
                  className={styles.input}
                >
                  <option value="MINIMAL">MINIMAL (高速・省トークン)</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH (最高推論・デフォルト)</option>
                </select>
                <small style={{ color: '#888' }}>※Gemma 4やGemini 3以降のモデルで使用。推論の深さを調整します。</small>
              </div>
              <div className={styles.formGroup}>
                <label>Instruction: Battle (バトル用指示)</label>
                <textarea 
                  value={systemPrompt} 
                  onChange={e => setSystemPrompt(e.target.value)} 
                  className={styles.textarea}
                  style={{ minHeight: '120px' }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Instruction: Epilogue (後日譚用指示)</label>
                <textarea 
                  value={epiloguePrompt} 
                  onChange={e => setEpiloguePrompt(e.target.value)} 
                  className={styles.textarea}
                  style={{ minHeight: '120px' }}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={showThinking} 
                    onChange={e => setShowThinking(e.target.checked)} 
                  />
                  AIの思考プロセスを表示する
                </label>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />
              
              <div className={styles.formGroup}>
                <label>💾 Save current settings as New Instruction</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={newPresetName} 
                    onChange={e => setNewPresetName(e.target.value)} 
                    className={styles.input}
                    placeholder="Instruction name (e.g. Comical Battle)"
                  />
                  <Button type="button" variant="secondary" onClick={handleSaveNewPreset} disabled={!newPresetName.trim()}>
                    Save New
                  </Button>
                </div>
              </div>

              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => {
                  setSystemPrompt('以下のキャラクターたちが熱いバトルを行います。設定に基づいて、臨場感のある劇的なバトルの展開と、最終的に誰が勝つかを決定し、シナリオを出力してください。文章は小説のようなトーンで作成してください。出力要件: 1. バトル開始の状況 2. スキル・アイテムを駆使した攻防 3. クライマックス 4. 明確な勝者の宣言（最後に「勝者: [キャラクター名]」という形式で終わること）');
                  setEpiloguePrompt('以下のバトルの結果を受けて、その後の後日譚（エピローグ）を短編小説風に作成してください。敗者のその後や、勝者の葛藤、周囲の反応なども含めて情緒的に描いてください。');
                }}>Reset Prompts to Default</Button>
                <div style={{ flexGrow: 1 }} />
                <Button variant="secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Apply Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plugin System Integration */}
      <PluginManager battleResult={battleLog ? { log_text: battleLog } : undefined} />

      {/* Battle Results & Plugin Logs */}
      {(battleLog || pluginLogs.length > 0) && (
        <div className={styles.battleControls} style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.3)' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Battle Results</h2>
          
          {battleLog && (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '2rem' }}>
              {battleLog}
            </div>
          )}

          {pluginLogs.map((log, i) => (
            <div key={i} style={{ 
              marginTop: '1.5rem', 
              padding: '1.5rem', 
              background: 'rgba(37, 99, 235, 0.1)', 
              borderLeft: '4px solid #2563eb',
              borderRadius: '8px'
            }}>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{log.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
