
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { useBattleRealtime } from '@/hooks/useBattleRealtime';
import { useHistory } from '@/hooks/useHistory';
import { useQueue } from '@/hooks/useQueue';
import { useUser, UserButton, SignInButton } from '@clerk/nextjs';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

// DnD Kit for Queue
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableQueueItem } from '@/components/SortableQueueItem';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'];

function ArenaContent() {
  const { characters, isLoaded: charLoaded, addCharacter, editCharacter, deleteCharacter, fetchVariants, saveVariant } = useCharacters();
  const { items, isLoaded: itemsLoaded, addItem, editItem, deleteItem } = useItems();
  const { settings, presets, isLoaded: settingsLoaded, saveSettings, createPreset, deletePreset } = useSettings();
  const { isLoaded: isAuthLoaded, user, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  
  const { history, fetchHistory } = useHistory(user?.id);
  const { queue, isProcessing, handleDragEnd, deleteQueueItem, processQueue } = useQueue(user?.id, characters, items);

  const [globalTab, setGlobalTab] = useState<'arena' | 'history' | 'queue'>('arena');
  
  interface EntrySocket {
    id: string;
    charId: string | null;
    itemIds: string[];
  }
  const [entrySockets, setEntrySockets] = useState<EntrySocket[]>([
    { id: 'socket_1', charId: null, itemIds: [] },
    { id: 'socket_2', charId: null, itemIds: [] }
  ]);
  
  const [activeSocketId, setActiveSocketId] = useState<string | null>(null);
  const [activeSocketForItems, setActiveSocketForItems] = useState<string | null>(null);
  const [isCharSelectionModalOpen, setIsCharSelectionModalOpen] = useState(false);
  const [isItemSelectionModalOpen, setIsItemSelectionModalOpen] = useState(false);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [charDescription, setCharDescription] = useState('');
  const [charItemId, setCharItemId] = useState('');
  const [charColor, setCharColor] = useState(COLORS[0]);
  const [charVariants, setCharVariants] = useState<any[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [thinkingLevel, setThinkingLevel] = useState<'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [provider, setProvider] = useState<'google' | 'lightning'>('google');
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useBattleRealtime();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'history' || t === 'queue' || t === 'arena') setGlobalTab(t as any);
  }, [searchParams]);

  useEffect(() => {
    const handleStatusChange = async (e: any) => {
      const data = e.detail;
      setNotification({ message: data.message, type: data.status === 'failed' ? 'error' : 'info' });
      if (data.status === 'completed' && data.resultId) {
        setNotification({ message: 'Battle Complete! Check History.', type: 'success' });
        fetchHistory();
      }
      setTimeout(() => setNotification(null), 5000);
    };
    window.addEventListener('battleStatusChange', handleStatusChange);
    return () => window.removeEventListener('battleStatusChange', handleStatusChange);
  }, [fetchHistory]);

  const openCharModal = async (id?: string) => {
    if (id) {
      const char = characters.find(c => c.id === id);
      if (char) {
        setEditingCharId(id); setCharName(char.name); setCharDescription(char.description); setCharItemId(char.itemId || ''); setCharColor(char.color || COLORS[0]);
        const vars = await fetchVariants(id); setCharVariants(vars);
      }
    } else {
      setEditingCharId(null); setCharName(''); setCharDescription(''); setCharItemId(''); setCharColor(COLORS[0]); setCharVariants([]);
    }
    setNewVariantName(''); setIsCharModalOpen(true);
  };

  const saveChar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCharId) await editCharacter(editingCharId, charName, charDescription, charItemId, charColor);
    else await addCharacter(charName, charDescription, charItemId, charColor);
    setIsCharModalOpen(false);
  };

  const startBattle = async () => {
    const validSockets = entrySockets.filter(s => s.charId);
    if (validSockets.length < 2 || !user) return;
    try {
      const participantPayload = validSockets.map(s => `${s.charId}::${s.itemIds.join(',')}`);
      const { data, error } = await supabase.from('battle_queue').insert({
        user_id: user.id, participant_ids: participantPayload, p1_id: validSockets[0].charId, p2_id: validSockets[1].charId,
        system_prompt: settings.systemPrompt, model: settings.model, temperature: settings.temperature, provider: settings.provider,
        status: 'pending', created_at: Date.now()
      }).select('id').single();
      if (error) throw error;
      fetch('/api/queue/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queueId: data.id, userId: user.id }) });
    } catch (err: any) { alert(err.message); }
  };

  const openSettings = () => {
    setSystemPrompt(settings.systemPrompt); setModel(settings.model); setTemperature(settings.temperature);
    setShowThinking(settings.showThinking); setThinkingBudget(settings.thinkingBudget); setThinkingLevel(settings.thinkingLevel || 'HIGH');
    setProvider(settings.provider || 'google'); setIsSettingsOpen(true);
  };

  const handlePreviewPrompt = () => {
    const validSockets = entrySockets.filter(s => s.charId);
    if (validSockets.length < 1) {
      alert("At least one character must be selected to preview.");
      return;
    }
    
    // Construct Player Info exactly like backend
    let playerInfo = '';
    validSockets.forEach((s) => {
      const char = characters.find(c => c.id === s.charId);
      if (char) {
        const socketItems = s.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean);
        let itemsStr = '';
        if (socketItems.length > 0) {
          itemsStr = `\n装備アイテム:\n` + socketItems.map((item: any) => `・${item.name} - ${item.description}`).join('\n');
        }
        playerInfo += `\n# キャラクター: ${char.name}\n${char.description}${itemsStr}\n`;
      }
    });

    const finalPrompt = `
${systemPrompt}

### 参加者データ
${playerInfo}

上記のキャラクターによる対戦シミュレーション（物語や実況）を自由なテキスト形式で出力し、対戦の最後に必ず「勝者: [キャラクター名]」と記載してください。
`.trim();
    
    const fullPayload = {
      provider,
      model,
      temperature,
      thinking_config: showThinking ? { 
        include_thoughts: true, 
        thinking_budget: thinkingBudget, 
        thinking_level: thinkingLevel 
      } : 'disabled',
      prompt: finalPrompt
    };
    
    setPreviewPrompt(JSON.stringify(fullPayload, null, 2));
    setIsPreviewModalOpen(true);
  };

  const selectSocketChar = (charId: string) => {
    if (activeSocketId) {
      setEntrySockets(prev => {
        const newSockets = prev.map(s => s.id === activeSocketId ? { ...s, charId } : s);
        if (newSockets[newSockets.length - 1].charId !== null) return [...newSockets, { id: `socket_${Date.now()}`, charId: null, itemIds: [] }];
        return newSockets;
      });
    }
    setIsCharSelectionModalOpen(false); setActiveSocketId(null);
  };

  const toggleSocketItem = (itemId: string) => {
    if (activeSocketForItems) {
      setEntrySockets(prev => prev.map(s => {
        if (s.id === activeSocketForItems) return { ...s, itemIds: s.itemIds.includes(itemId) ? s.itemIds.filter(id => id !== itemId) : [...s.itemIds, itemId] };
        return s;
      }));
    }
  };

  if (!charLoaded || !itemsLoaded || !settingsLoaded || !isAuthLoaded) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const getSliderTransform = () => {
    if (globalTab === 'arena') return 'translateX(0%)';
    if (globalTab === 'history') return 'translateX(-33.333%)';
    if (globalTab === 'queue') return 'translateX(-66.666%)';
    return 'translateX(0%)';
  };

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <div className={styles.tabNav}>
        <div className={`${styles.tabNavItem} ${globalTab === 'arena' ? styles.tabNavItemActive : ''}`} onClick={() => setGlobalTab('arena')}>ARENA</div>
        <div className={`${styles.tabNavItem} ${globalTab === 'history' ? styles.tabNavItemActive : ''}`} onClick={() => setGlobalTab('history')}>HISTORY</div>
        <div className={`${styles.tabNavItem} ${globalTab === 'queue' ? styles.tabNavItemActive : ''}`} onClick={() => setGlobalTab('queue')}>QUEUE</div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '1rem 2rem', borderRadius: '12px', zIndex: 11000,
          background: notification.type === 'error' ? '#dc2626' : notification.type === 'success' ? '#16a34a' : '#2563eb',
          color: 'white', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {notification.message}
        </div>
      )}

      <div className={styles.viewport}>
        <div className={styles.slider} style={{ transform: getSliderTransform() }}>
          
          {/* TAB 1: ARENA */}
          <div className={styles.tabContent}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Battle Arena</h2>
              <div style={{ flexGrow: 1 }} />
              <Button variant="secondary" onClick={openSettings}>Settings</Button>
              <div style={{ marginLeft: '1rem' }}>
                {isSignedIn ? <UserButton /> : (
                  <SignInButton mode="modal">
                    <button style={{ background: '#2563eb', color: 'white', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
                  </SignInButton>
                )}
              </div>
            </div>

            <div className={styles.rosterSection} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {entrySockets.map((s, idx) => {
                  const char = s.charId ? characters.find(c => c.id === s.charId) : null;
                  return (
                    <div key={s.id} className={styles.characterCard} style={{ flex: '1 1 300px', border: char ? `2px solid ${char.color}` : '2px dashed #444', padding: '1.5rem', borderRadius: '12px', position: 'relative' }}>
                      <div style={{ opacity: 0.5, marginBottom: '0.5rem' }}>Socket {idx + 1}</div>
                      {char ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{char.name}</span>
                          <Button variant="secondary" onClick={() => { setActiveSocketId(s.id); setIsCharSelectionModalOpen(true); }}>Change</Button>
                        </div>
                      ) : (
                        <Button variant="secondary" onClick={() => { setActiveSocketId(s.id); setIsCharSelectionModalOpen(true); }} style={{ width: '100%', padding: '1rem' }}>+ Character</Button>
                      )}
                      <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            <span>Items ({s.itemIds.length})</span>
                            <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => { setActiveSocketForItems(s.id); setIsItemSelectionModalOpen(true); }}>+ Add</span>
                          </div>
                          {s.itemIds.map(id => <div key={id} style={{ fontSize: '0.8rem' }}>• {items.find(i => i.id === id)?.name}</div>)}
                      </div>
                      {entrySockets.length > 2 && <button onClick={() => setEntrySockets(prev => prev.filter(x => x.id !== s.id))} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>✕</button>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <Button onClick={startBattle} disabled={entrySockets.filter(s => s.charId).length < 2} style={{ padding: '1rem 4rem' }}>START BATTLE</Button>
              </div>
            </div>

            <div className={styles.rosterHeader}>
              <h2>Management</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={() => openCharModal()}>+ Char</Button>
                <Button variant="secondary" onClick={() => { setEditingItemId(null); setItemName(''); setItemDesc(''); setIsItemModalOpen(true); }}>+ Item</Button>
              </div>
            </div>
            <div className={styles.grid}>
              {characters.map(c => (
                <Card key={c.id} onClick={() => openCharModal(c.id)}>
                  <div style={{ fontWeight: 'bold' }}><span style={{ color: c.color }}>●</span> {c.name}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{c.description.substring(0, 50)}...</div>
                </Card>
              ))}
            </div>
          </div>

          {/* TAB 2: HISTORY */}
          <div className={styles.tabContent}>
            <header className={styles.header}>
              <h1 className={styles.title}>History</h1>
              <Button variant="secondary" onClick={fetchHistory}>Refresh</Button>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map(h => (
                <Card key={h.id} onClick={() => setSelectedHistory(h)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{h.winner_name ? `Winner: ${h.winner_name}` : 'Draw / No Winner'}</strong>
                      <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{new Date(h.created_at).toLocaleString()}</div>
                    </div>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>View Result ↗</span>
                  </div>
                </Card>
              ))}
              {history.length === 0 && <div className={styles.emptyState}>No history yet.</div>}
            </div>
          </div>

          {/* TAB 3: QUEUE */}
          <div className={styles.tabContent}>
            <header className={styles.header}>
              <h1 className={styles.title}>Queue</h1>
              <Button variant="secondary" onClick={() => processQueue(settings)} disabled={isProcessing}>{isProcessing ? 'Processing...' : 'Run Queue'}</Button>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {queue.map(q => {
                  const names = q.participant_ids ? q.participant_ids.map((id: string) => characters.find(c => c.id === id.split('::')[0])?.name || '???') : ['???', '???'];
                  return <SortableQueueItem key={q.id} q={q} fighterNames={names} deleteQueueItem={deleteQueueItem} />;
                })}
              </SortableContext>
            </DndContext>
            {queue.length === 0 && <div className={styles.emptyState}>Queue is empty.</div>}
          </div>

        </div>
      </div>

      {/* MODALS */}
      {selectedHistory && (
        <div className={styles.modalOverlay} onClick={() => setSelectedHistory(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>Battle Result</h2>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem' }}>{selectedHistory.log_text}</div>
            <div className={styles.modalActions}>
              <Button onClick={() => setSelectedHistory(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Settings & System Instructions</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              saveSettings({ systemPrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
              setIsSettingsOpen(false);
            }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Current Preset</h3>
                <div className={styles.formGroup}><label>API Provider</label><select value={provider} onChange={e => setProvider(e.target.value as any)} className={styles.input}><option value="google">Google AI</option><option value="lightning">Lightning AI</option></select></div>
                <div className={styles.formGroup}><label>Model</label><input type="text" value={model} onChange={e => setModel(e.target.value)} className={styles.input} required /></div>
                <div className={styles.formGroup}><label>Temperature ({temperature})</label><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} /></div>
                <div className={styles.formGroup}><label>Instruction (System Prompt)</label><textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className={styles.textarea} style={{ minHeight: '120px' }} required /></div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Manage Presets</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {presets.length === 0 ? <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No presets saved.</p> : presets.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 'bold', cursor: 'pointer', flexGrow: 1 }} onClick={() => {
                        setSystemPrompt(p.systemPrompt); setModel(p.model); setTemperature(p.temperature); setProvider(p.provider);
                      }}>{p.name}</span>
                      <button type="button" onClick={() => deletePreset(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} className={styles.input} placeholder="New preset name..." />
                  <Button type="button" variant="secondary" onClick={() => { if(!newPresetName.trim()) return; createPreset(newPresetName, { systemPrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider }); setNewPresetName(''); }} disabled={!newPresetName.trim()}>Save Current</Button>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 99, 71, 0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255, 99, 71, 0.2)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#ff6347' }}>Dev Tools</h3>
                <Button type="button" variant="secondary" onClick={handlePreviewPrompt} style={{ width: '100%' }}>Preview Request Prompt (AI送信内容の確認)</Button>
              </div>

              <div className={styles.modalActions}>
                <Button variant="secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Apply Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPreviewModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsPreviewModalOpen(false)}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Request Prompt Preview</h2>
            <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'monospace', border: '1px solid #444' }}>
              {previewPrompt}
            </div>
            <div className={styles.modalActions}>
              <Button onClick={() => setIsPreviewModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {isCharModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>{editingCharId ? 'Edit Character' : 'New Character'}</h2>
            <form onSubmit={saveChar}>
              <div className={styles.formGroup}><label>Name</label><input className={styles.input} value={charName} onChange={e => setCharName(e.target.value)} required /></div>
              <div className={styles.formGroup}><label>Description</label><textarea className={styles.textarea} value={charDescription} onChange={e => setCharDescription(e.target.value)} required /></div>
              <div className={styles.formGroup}><label>Permanent Item</label><select className={styles.input} value={charItemId} onChange={e => setCharItemId(e.target.value)}><option value="">-- None --</option>{items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select></div>
              <div className={styles.modalActions}><Button variant="secondary" onClick={() => setIsCharModalOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>{editingItemId ? 'Edit Item' : 'New Item'}</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingItemId) editItem(editingItemId, itemName, itemDesc);
              else addItem(itemName, itemDesc);
              setIsItemModalOpen(false);
            }}>
              <div className={styles.formGroup}><label>Name</label><input className={styles.input} value={itemName} onChange={e => setItemName(e.target.value)} required /></div>
              <div className={styles.formGroup}><label>Description</label><textarea className={styles.textarea} value={itemDesc} onChange={e => setItemDesc(e.target.value)} required /></div>
              <div className={styles.modalActions}><Button variant="secondary" onClick={() => setIsItemModalOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
          </div>
        </div>
      )}

      {isCharSelectionModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px' }}>
            <h2>Select Character</h2>
            <div className={styles.grid}>{characters.map(c => <Card key={c.id} onClick={() => selectSocketChar(c.id)}>{c.name}</Card>)}</div>
            <Button style={{ marginTop: '1rem' }} onClick={() => setIsCharSelectionModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isItemSelectionModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px' }}>
            <h2>Select Items</h2>
            <div className={styles.grid}>{items.map(it => <Card key={it.id} selected={entrySockets.find(s => s.id === activeSocketForItems)?.itemIds.includes(it.id)} onClick={() => toggleSocketItem(it.id)}>{it.name}</Card>)}</div>
            <Button style={{ marginTop: '1rem' }} onClick={() => setIsItemSelectionModalOpen(false)}>Done</Button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading Arena...</div>}>
      <ArenaContent />
    </Suspense>
  );
}
