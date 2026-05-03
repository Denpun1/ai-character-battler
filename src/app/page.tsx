
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { useBattleRealtime } from '@/hooks/useBattleRealtime';
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
  interface EntrySocket {
    id: string;
    charId: string | null;
    itemIds: string[];
  }
  const [entrySockets, setEntrySockets] = useState<EntrySocket[]>([
    { id: 'socket_1', charId: null, itemIds: [] },
    { id: 'socket_2', charId: null, itemIds: [] }
  ]);
  const [activeSocketId, setActiveSocketId] = useState<string | null>(null); // For Character Selection Modal
  const [activeSocketForItems, setActiveSocketForItems] = useState<string | null>(null); // For Item Selection Modal
  const [isCharSelectionModalOpen, setIsCharSelectionModalOpen] = useState(false);
  const [isItemSelectionModalOpen, setIsItemSelectionModalOpen] = useState(false);

  
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
  const [newPresetName, setNewPresetName] = useState('');

  // Plugin System States
  const [battleLog, setBattleLog] = useState<string | null>(null);
  const [pluginLogs, setPluginLogs] = useState<any[]>([]);
  const [pluginButtons, setPluginButtons] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'entry' | 'result'>('entry');
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  useBattleRealtime();

  useEffect(() => {
    const handleStatusChange = async (e: any) => {
      const data = e.detail;
      
      // Notify status change
      setNotification({ message: data.message, type: data.status === 'failed' ? 'error' : 'info' });
      
      if (data.status === 'completed' && data.resultId) {
        const { data: result } = await supabase.from('battle_history').select('*').eq('id', data.resultId).single();
        if (result) {
          setBattleLog(result.log_text);
          setNotification({ message: '対戦が完了しました！', type: 'success' });
          setActiveTab('result'); // Auto-switch to result tab
          window.dispatchEvent(new CustomEvent('plugin:run', { 
            detail: { triggerType: 'end', contextOverride: { battleResult: result } } 
          }));
        }
      }
      
      // Auto-clear notification after 5s
      setTimeout(() => setNotification(null), 5000);
    };

    const handlePluginUI = (e: any) => {
      setPluginLogs(prev => [...prev, e.detail]);
    };

    const handlePluginButton = (e: any) => {
      setPluginButtons(prev => [...prev, e.detail]);
    };

    window.addEventListener('battleStatusChange', handleStatusChange);
    window.addEventListener('plugin:ui:display', handlePluginUI);
    window.addEventListener('plugin:ui:button', handlePluginButton);
    return () => {
      window.removeEventListener('battleStatusChange', handleStatusChange);
      window.removeEventListener('plugin:ui:display', handlePluginUI);
      window.removeEventListener('plugin:ui:button', handlePluginButton);
    };
  }, []);

  const handlePluginButtonClick = (nodeId: string) => {
    setPluginButtons(prev => prev.filter(b => b.nodeId !== nodeId));
    window.dispatchEvent(new CustomEvent('plugin:run', { 
      detail: { triggerType: 'node_click', startNodeId: nodeId } 
    }));
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

  const addSocket = () => {
    setEntrySockets(prev => [...prev, { id: `socket_${Date.now()}`, charId: null, itemIds: [] }]);
  };

  const removeSocket = (socketId: string) => {
    setEntrySockets(prev => prev.filter(s => s.id !== socketId));
  };

  const openSocketCharModal = (socketId: string) => {
    setActiveSocketId(socketId);
    setIsCharSelectionModalOpen(true);
  };

  const selectSocketChar = (charId: string) => {
    if (activeSocketId) {
      setEntrySockets(prev => {
        const newSockets = prev.map(s => s.id === activeSocketId ? { ...s, charId } : s);
        // Automatically add a new empty socket if we are filling the last available slot
        if (newSockets[newSockets.length - 1].charId !== null) {
          return [...newSockets, { id: `socket_${Date.now()}`, charId: null, itemIds: [] }];
        }
        return newSockets;
      });
    }
    setIsCharSelectionModalOpen(false);
    setActiveSocketId(null);
  };

  const openSocketItemModal = (socketId: string) => {
    setActiveSocketForItems(socketId);
    setIsItemSelectionModalOpen(true);
  };

  const toggleSocketItem = (itemId: string) => {
    if (activeSocketForItems) {
      setEntrySockets(prev => prev.map(s => {
        if (s.id === activeSocketForItems) {
          const newItemIds = s.itemIds.includes(itemId) 
            ? s.itemIds.filter(id => id !== itemId) 
            : [...s.itemIds, itemId];
          return { ...s, itemIds: newItemIds };
        }
        return s;
      }));
    }
  };

  const openSettings = () => {
    setSystemPrompt(settings.systemPrompt);
    setModel(settings.model);
    setTemperature(settings.temperature);
    setThinkingLevel(settings.thinkingLevel || 'HIGH');
    setProvider(settings.provider || 'google');
    setIsSettingsOpen(true);
  };

  const saveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ systemPrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
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
      setProvider(p.provider);
    }
  };

  const handleSaveNewPreset = () => {
    if (!newPresetName.trim()) return;
    createPreset(newPresetName, { systemPrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
    setNewPresetName('');
  };

  const startBattle = async () => {
    const validSockets = entrySockets.filter(s => s.charId);
    if (validSockets.length < 2 || !user) {
      setNotification({ message: '最低2つのキャラクターをセットしてください', type: 'error' });
      return;
    }
    
    // Fire 'start' trigger for plugins (so plugins set to run BEFORE battle will execute)
    window.dispatchEvent(new CustomEvent('plugin:run', { 
      detail: { triggerType: 'start' } 
    }));

    try {
      const participantPayload = validSockets.map(s => `${s.charId}::${s.itemIds.join(',')}`);

      // Fallback variables for backward compatibility if needed by old DB schema constraints
      const p1Id = validSockets[0]?.charId || null;
      const p2Id = validSockets[1]?.charId || null;

      const { data, error } = await supabase.from('battle_queue').insert({
        user_id: user.id,
        participant_ids: participantPayload, // N-way support with items packed
        p1_id: p1Id, // Fallback for 2-way logic
        p2_id: p2Id,
        system_prompt: settings.systemPrompt, // Always use truth from settings
        model: settings.model,
        temperature: settings.temperature,
        provider: settings.provider,
        status: 'pending',
        created_at: Date.now()
      }).select('id').single();
      if (error) throw error;
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
      <PluginManager 
        battleResult={battleLog ? { log_text: battleLog } : undefined} 
        systemPrompt={settings.systemPrompt}
      />

      {/* Global Plugin UI overlays (Absolute & Sidebar) */}
      {pluginButtons.filter(b => b.posMode === 'absolute').map((btn, i) => (
        <div key={`global-btn-${i}`} style={{ 
          position: 'fixed', left: btn.posX, top: btn.posY, zIndex: 9999,
          width: btn.width ? `${btn.width}px` : 'auto',
          height: btn.height ? `${btn.height}px` : 'auto'
        }}>
          <Button onClick={() => handlePluginButtonClick(btn.nodeId)} style={{ width: '100%', height: '100%' }}>
            {btn.label}
          </Button>
        </div>
      ))}
      {pluginLogs.filter(log => log.posMode === 'absolute').map((log, i) => (
        <div key={`global-log-${i}`} style={{ 
          position: 'fixed', left: log.posX, top: log.posY, zIndex: 9999,
          width: log.width ? `${log.width}px` : '300px',
          height: log.height ? `${log.height}px` : 'auto',
          pointerEvents: 'none'
        }}>
          <div style={log.mode === 'box' ? { 
            padding: '1rem', background: 'rgba(0,0,0,0.8)', border: '1px solid #2563eb', borderRadius: '8px',
            width: '100%', height: '100%', overflow: 'auto'
          } : { textShadow: '2px 2px 4px rgba(0,0,0,0.8)', width: '100%', height: '100%' }}>
            {log.message}
          </div>
        </div>
      ))}
      {pluginLogs.filter(log => log.slot === 'sidebar' && log.posMode !== 'absolute').length > 0 && (
        <div style={{ 
          position: 'fixed', top: '100px', right: '2rem', width: '250px', 
          display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 100 
        }}>
          {pluginLogs.filter(log => log.slot === 'sidebar' && log.posMode !== 'absolute').map((log, i) => (
            <div key={`global-sidebar-${i}`} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.8)', border: '1px solid #2563eb', borderRadius: '8px', fontSize: '0.85rem' }}>
              {log.message}
            </div>
          ))}
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Welcome to the Arena</h1>
        <div>
          <Button variant="secondary" onClick={openSettings}>Settings (Presets)</Button>
        </div>
      </header>
      
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '1rem 2rem', borderRadius: '12px', zIndex: 11000,
          background: notification.type === 'error' ? '#dc2626' : notification.type === 'success' ? '#16a34a' : '#2563eb',
          color: 'white', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('entry')}
          style={{ 
            padding: '0.5rem 1.5rem', background: 'transparent', border: 'none', 
            color: activeTab === 'entry' ? '#2563eb' : 'var(--foreground)',
            borderBottom: activeTab === 'entry' ? '2px solid #2563eb' : 'none',
            cursor: 'pointer', fontSize: '1.1rem', fontWeight: activeTab === 'entry' ? 'bold' : 'normal'
          }}
        >
          Entry
        </button>
        <button 
          onClick={() => setActiveTab('result')}
          style={{ 
            padding: '0.5rem 1.5rem', background: 'transparent', border: 'none', 
            color: activeTab === 'result' ? '#2563eb' : 'var(--foreground)',
            borderBottom: activeTab === 'result' ? '2px solid #2563eb' : 'none',
            cursor: 'pointer', fontSize: '1.1rem', fontWeight: activeTab === 'result' ? 'bold' : 'normal'
          }}
        >
          Result
        </button>
      </div>

      {activeTab === 'entry' ? (
        <>
          {/* Entry Sockets Section */}
          <div className={styles.rosterSection} style={{ marginBottom: '3rem', padding: '2rem', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '16px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
            <div className={styles.rosterHeader}>
              <h2 style={{ color: '#60a5fa' }}>Battle Entry</h2>
              {/* Removed manual Add Socket button as it is now automatic */}
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
              {entrySockets.map((s, idx) => {
                const char = s.charId ? characters.find(c => c.id === s.charId) : null;
                return (
                  <div key={s.id} className={styles.characterCard} style={{ flex: '1 1 300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', border: char ? `2px solid ${char.color}` : '2px dashed rgba(255,255,255,0.1)', padding: '1.5rem', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.03)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--foreground)', opacity: 0.8 }}>Socket {idx + 1}</div>
                    
                    {/* Allow deleting any socket except if it's the very last empty one and we only have 1 */}
                    {(entrySockets.length > 1 && (s.charId || idx < entrySockets.length - 1)) && (
                      <button onClick={() => removeSocket(s.id)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                    )}
                    
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                      {char ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}><span style={{ color: char.color, marginRight: '8px' }}>●</span>{char.name}</span>
                          <Button variant="secondary" onClick={() => openSocketCharModal(s.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Change</Button>
                        </div>
                      ) : (
                        <Button variant="secondary" onClick={() => openSocketCharModal(s.id)} style={{ width: '100%', padding: '1rem', border: '1px dashed rgba(255,255,255,0.3)' }}>Select Character</Button>
                      )}
                    </div>

                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Equipped Items</span>
                        {char && <Button variant="secondary" onClick={() => openSocketItemModal(s.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>+ Add Item</Button>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {s.itemIds.length === 0 ? (
                          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>No items equipped.</div>
                        ) : (
                          s.itemIds.map(itemId => {
                            const item = items.find(i => i.id === itemId);
                            return item ? (
                              <div key={itemId} style={{ fontSize: '0.9rem', padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{item.name}</span>
                                <button onClick={() => toggleSocketItem(itemId)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                              </div>
                            ) : null;
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
              <Button onClick={startBattle} disabled={entrySockets.filter(s => s.charId).length < 2} style={{ padding: '1rem 3rem', fontSize: '1.2rem', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)' }}>
                Start Battle ({entrySockets.filter(s => s.charId).length} Fighters)
              </Button>
            </div>
          </div>

          {/* Characters Management Section */}
      <div className={styles.rosterSection} style={{ marginBottom: '3rem' }}>
        <div className={styles.rosterHeader}>
          <h2>Character Management</h2>
          <Button onClick={() => openCharModal()}>New Character</Button>
        </div>
        {characters.length === 0 ? (
          <div className={styles.emptyState}>No characters. Create some to start.</div>
        ) : (
          <div className={styles.grid}>
            {characters.map(char => {
              const equippedItem = char.itemId ? items.find(i => i.id === char.itemId) : null;
              return (
                <Card key={char.id} className={styles.characterCard}>
                  <div className={styles.characterName}>
                    <span style={{ color: char.color, marginRight: '8px' }}>●</span>
                    {char.name}
                  </div>
                  {equippedItem && <div className={styles.characterItem}>Permanent Item: {equippedItem.name}</div>}
                  <div className={styles.characterSkills}>
                    {char.skills.length > 80 ? `${char.skills.substring(0, 80)}...` : char.skills}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', alignSelf: 'flex-end' }}>
                    <button className={styles.deleteBtn} style={{ color: 'var(--foreground)' }} onClick={(e) => { e.stopPropagation(); openCharModal(char.id); }}>Edit</button>
                    <button className={styles.deleteBtn} onClick={(e) => {
                      e.stopPropagation();
                      deleteCharacter(char.id);
                    }}>Delete</button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Items Management Section */}
      <div className={styles.rosterSection}>
        <div className={styles.rosterHeader}>
          <h2>Item Management</h2>
          <Button onClick={() => openItemModal()}>New Item</Button>
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
                  <button className={styles.deleteBtn} style={{ color: 'var(--foreground)' }} onClick={() => openItemModal(it.id)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => deleteItem(it.id)}>Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {isCharModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{editingCharId ? 'Edit Character' : 'Create New Character'}</h2>
            <form onSubmit={saveChar}>
              <div className={styles.formGroup}><label>Name</label><input type="text" value={charName} onChange={e => setCharName(e.target.value)} className={styles.input} required /></div>
              <div className={styles.formGroup}><label>Description</label><textarea value={charSkills} onChange={e => setCharSkills(e.target.value)} className={styles.textarea} required /></div>
              <div className={styles.formGroup}><label>Item</label><select value={charItemId} onChange={e => setCharItemId(e.target.value)} className={styles.input}><option value="">-- None --</option>{items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select></div>
              <div className={styles.formGroup}><label>Color</label><div style={{ display: 'flex', gap: '8px' }}>{COLORS.map(c => <div key={c} onClick={() => setCharColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c, border: charColor === c ? '2px solid var(--foreground)' : '2px solid transparent', cursor: 'pointer' }} />)}</div></div>
              <div className={styles.modalActions}><Button variant="secondary" type="button" onClick={() => setIsCharModalOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
              {editingCharId && (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <h3>📜 History & Variants</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input type="text" value={newVariantName} onChange={e => setNewVariantName(e.target.value)} className={styles.input} placeholder="Variant name..." />
                    <Button type="button" variant="secondary" onClick={handleSaveVariant} disabled={!newVariantName.trim()}>Save as Variant</Button>
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {charVariants.map(v => (
                      <div key={v.id} style={{ padding: '0.5rem', background: 'var(--border)', marginBottom: '4px' }}>
                        <div><strong>{v.isBackup ? 'Auto-Backup' : v.name}</strong></div>
                        <Button type="button" variant="secondary" onClick={() => loadVariant(v.skills)}>Restore</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>{editingItemId ? 'Edit Item' : 'Create New Item'}</h2>
            <form onSubmit={saveItem}>
              <div className={styles.formGroup}><label>Name</label><input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className={styles.input} required /></div>
              <div className={styles.formGroup}><label>Description</label><textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} className={styles.textarea} required /></div>
              <div className={styles.modalActions}><Button variant="secondary" type="button" onClick={() => setIsItemModalOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          </div>
        </div>
      )}

      {isCharSelectionModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className={styles.modalTitle}>Select Character for Socket</h2>
            <div className={styles.grid}>
              {characters.map(char => (
                <Card key={char.id} className={styles.characterCard} onClick={() => selectSocketChar(char.id)}>
                  <div className={styles.characterName}>
                    <span style={{ color: char.color, marginRight: '8px' }}>●</span>
                    {char.name}
                  </div>
                  <div className={styles.characterSkills}>
                    {char.skills.length > 80 ? `${char.skills.substring(0, 80)}...` : char.skills}
                  </div>
                </Card>
              ))}
            </div>
            <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
              <Button variant="secondary" onClick={() => setIsCharSelectionModalOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {isItemSelectionModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className={styles.modalTitle}>Select Item to Equip</h2>
            <div className={styles.grid}>
              {items.map(it => {
                const isActive = activeSocketForItems ? entrySockets.find(s => s.id === activeSocketForItems)?.itemIds.includes(it.id) : false;
                return (
                  <Card key={it.id} className={styles.characterCard} selected={isActive} onClick={() => toggleSocketItem(it.id)}>
                    <div className={styles.characterName}>{it.name}</div>
                    <div className={styles.characterSkills}>{it.description}</div>
                  </Card>
                );
              })}
            </div>
            <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
              <Button onClick={() => setIsItemSelectionModalOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <h2>Settings</h2>
            <form onSubmit={saveSettingsForm}>
              <div className={styles.formGroup}><label>API Provider</label><select value={provider} onChange={e => setProvider(e.target.value as any)} className={styles.input}><option value="google">Google AI</option><option value="lightning">Lightning AI</option></select></div>
              <div className={styles.formGroup}><label>Model</label><input type="text" value={model} onChange={e => setModel(e.target.value)} className={styles.input} required /></div>
              <div className={styles.formGroup}><label>Temperature</label><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} /></div>
              <div className={styles.formGroup}>
                <label>📋 Load Saved Instruction (プリセット読み込み)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    className={styles.input} 
                    onChange={e => handleLoadPreset(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select Preset --</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
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
                  setSystemPrompt('');
                }}>Reset Prompts to Default</Button>
                <div style={{ flexGrow: 1 }} />
                <Button variant="secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Apply Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : (
        <div style={{ minHeight: '400px' }}>
          {/* Results & Plugin UI Slots */}
          {(battleLog || pluginLogs.length > 0 || pluginButtons.length > 0) ? (
            <div className={styles.battleControls} style={{ 
              marginTop: '0', 
              display: 'block', 
              background: 'rgba(0,0,0,0.4)', 
              position: 'relative',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              
              {/* Slot-based Action Bar */}
              {pluginButtons.filter(b => b.posMode !== 'absolute').length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  marginBottom: '1.5rem', 
                  padding: '1.2rem', 
                  background: 'rgba(37, 99, 235, 0.2)', 
                  borderRadius: '12px',
                  border: '1px solid #2563eb',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  animation: 'slideUp 0.3s ease-out'
                }}>
                  {pluginButtons.filter(b => b.posMode !== 'absolute').map((btn, i) => (
                    <Button key={i} onClick={() => handlePluginButtonClick(btn.nodeId)} style={{ minWidth: '150px' }}>
                      {btn.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Absolute-positioned Components (The "Pixel" Editor Result) */}
              {pluginButtons.filter(b => b.posMode === 'absolute').map((btn, i) => (
                <div key={`abs-btn-${i}`} style={{ 
                  position: 'fixed', left: btn.posX, top: btn.posY, zIndex: 9999,
                  width: btn.width ? `${btn.width}px` : 'auto',
                  height: btn.height ? `${btn.height}px` : 'auto'
                }}>
                  <Button 
                    onClick={() => handlePluginButtonClick(btn.nodeId)} 
                    style={{ width: '100%', height: '100%' }}
                  >
                    {btn.label}
                  </Button>
                </div>
              ))}

              {pluginLogs.filter(log => log.posMode === 'absolute').map((log, i) => (
                <div key={`abs-log-${i}`} style={{ 
                  position: 'fixed', left: log.posX, top: log.posY, zIndex: 9999,
                  width: log.width ? `${log.width}px` : '300px',
                  height: log.height ? `${log.height}px` : 'auto',
                  pointerEvents: 'none'
                }}>
                  <div style={log.mode === 'box' ? { 
                    padding: '1rem', background: 'rgba(0,0,0,0.8)', border: '1px solid #2563eb', borderRadius: '8px',
                    width: '100%', height: '100%', overflow: 'auto'
                  } : { textShadow: '2px 2px 4px rgba(0,0,0,0.8)', width: '100%', height: '100%' }}>
                    {log.message}
                  </div>
                </div>
              ))}

              <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: '#2563eb' }}>
                Battle Result
              </h2>
              
              <div style={{ display: 'flex', gap: '2rem', flexDirection: 'column' }}>
                {battleLog && (
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.8', 
                    fontSize: '1.1rem',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '2rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {battleLog}
                  </div>
                )}
                
                {pluginLogs.filter(log => log.slot === 'battle' && log.posMode !== 'absolute').map((log, i) => (
                  <div key={i} style={log.mode === 'box' ? { 
                    padding: '1.5rem', background: 'rgba(255, 255, 255, 0.05)', borderLeft: '4px solid #2563eb', borderRadius: '8px' 
                  } : { whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem' }}>
                    {log.message}
                  </div>
                ))}
              </div>

              {/* Sidebar Slot */}
              {pluginLogs.filter(log => log.slot === 'sidebar' && log.posMode !== 'absolute').length > 0 && (
                <div style={{ 
                  position: 'fixed', top: '100px', right: '2rem', width: '250px', 
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 100 
                }}>
                  {pluginLogs.filter(log => log.slot === 'sidebar' && log.posMode !== 'absolute').map((log, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.8)', border: '1px solid #2563eb', borderRadius: '8px', fontSize: '0.85rem' }}>
                      {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.emptyState}>No results to display. Start a battle in the Entry tab.</div>
          )}
        </div>
      )}
    </div>
  );
}
