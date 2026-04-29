
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useCharacters } from '@/hooks/useCharacters';
import { useItems } from '@/hooks/useItems';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/Button';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { PluginManager } from '@/components/PluginManager';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, isLoaded } = useCharacters();
  const { items, isLoaded: itemsLoaded } = useItems();
  const { settings, isLoaded: settingsLoaded, saveSettings, createPreset, presets, deletePreset } = useSettings();
  const { user } = useUser();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [battleLog, setBattleLog] = useState<string>('');
  const [isFighting, setIsFighting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(0);
  const [thinkingLevel, setThinkingLevel] = useState<'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [provider, setProvider] = useState<'google' | 'lightning'>('google');
  const [newPresetName, setNewPresetName] = useState('');

  const [pluginButtons, setPluginButtons] = useState<any[]>([]);
  const [pluginLogs, setPluginLogs] = useState<any[]>([]);

  useEffect(() => {
    if (settingsLoaded) {
      setSystemPrompt(settings.systemPrompt);
      setModel(settings.model);
      setTemperature(settings.temperature);
      setShowThinking(settings.showThinking || false);
      setThinkingBudget(settings.thinkingBudget || 0);
      setThinkingLevel(settings.thinkingLevel || 'HIGH');
      setProvider(settings.provider || 'google');
    }
  }, [settingsLoaded, settings]);

  useEffect(() => {
    const handleButton = (e: any) => setPluginButtons(prev => [...prev, e.detail]);
    const handleDisplay = (e: any) => setPluginLogs(prev => [...prev, e.detail]);
    const handleReset = () => {
      setPluginButtons([]);
      setPluginLogs([]);
    };

    window.addEventListener('plugin:ui:button', handleButton);
    window.addEventListener('plugin:ui:display', handleDisplay);
    window.addEventListener('plugin:reset', handleReset);

    return () => {
      window.removeEventListener('plugin:ui:button', handleButton);
      window.removeEventListener('plugin:ui:display', handleDisplay);
      window.removeEventListener('plugin:reset', handleReset);
    };
  }, []);

  const toggleCharacter = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const startBattle = async () => {
    if (selectedIds.length < 2 || !user) return;
    setIsFighting(true);
    setBattleLog('');
    setIsFinished(false);
    setPluginButtons([]);
    setPluginLogs([]);

    try {
      const { data, error } = await supabase.from('battle_queue').insert({
        user_id: user.id,
        participant_ids: selectedIds,
        system_prompt: systemPrompt,
        model: model,
        temperature: temperature,
        provider: provider,
        status: 'pending',
        created_at: Date.now()
      }).select('id').single();

      if (error) throw error;

      const subscription = supabase
        .channel(`battle_${data.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_queue', filter: `id=eq.${data.id}` }, (payload) => {
          if (payload.new.status === 'completed') {
            setBattleLog(payload.new.result);
            setIsFighting(false);
            setIsFinished(true);
            subscription.unsubscribe();
            window.dispatchEvent(new CustomEvent('plugin:run', { 
              detail: { triggerType: 'end', contextOverride: { battleResult: payload.new.result } } 
            }));
          }
        })
        .subscribe();
    } catch (err) {
      console.error(err);
      setIsFighting(false);
    }
  };

  const handlePluginButtonClick = (nodeId: string) => {
    setPluginButtons([]);
    window.dispatchEvent(new CustomEvent('plugin:run', { 
      detail: { triggerType: 'button_click', startNodeId: nodeId } 
    }));
  };

  const openSettings = () => {
    setSystemPrompt(settings.systemPrompt);
    setModel(settings.model);
    setTemperature(settings.temperature);
    setShowThinking(settings.showThinking || false);
    setThinkingBudget(settings.thinkingBudget || 0);
    setThinkingLevel(settings.thinkingLevel || 'HIGH');
    setProvider(settings.provider || 'google');
    setIsSettingsOpen(true);
  };

  const saveSettingsForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ systemPrompt, model, temperature, showThinking, thinkingBudget, thinkingLevel, provider });
    setIsSettingsOpen(false);
  };

  const handleSelectPreset = (p: any) => {
    if (confirm(`Load preset "${p.name}"?`)) {
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

  if (!isLoaded || !settingsLoaded || !itemsLoaded) return <div className={styles.container}>Loading Arena...</div>;

  return (
    <div className={styles.container}>
      <PluginManager 
        battleResult={battleLog ? { log_text: battleLog } : undefined} 
        systemPrompt={settings.systemPrompt}
      />
      
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>AI Character Battler</h1>
          <p className={styles.subtitle}>Select fighters and witness their clash</p>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" onClick={openSettings}>Settings</Button>
          <Button variant="secondary" onClick={() => router.push('/plugins')}>Plugins</Button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.characterGrid}>
          {characters.map(char => (
            <div 
              key={char.id} 
              className={`${styles.card} ${selectedIds.includes(char.id) ? styles.selected : ''}`}
              onClick={() => toggleCharacter(char.id)}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardName}>{char.name}</h3>
                <div className={styles.badge} style={{ background: char.color }}>LV.1</div>
              </div>
              <p className={styles.cardDesc}>{char.skills}</p>
            </div>
          ))}
        </div>

        <div className={styles.actionSection}>
          <Button 
            onClick={startBattle} 
            disabled={selectedIds.length < 2 || isFighting}
            className={styles.fightButton}
          >
            {isFighting ? 'BATTLE IN PROGRESS...' : 'START CLASH'}
          </Button>
        </div>

        {(battleLog || pluginLogs.length > 0 || pluginButtons.length > 0) && (
          <div className={styles.resultsArea} style={{ position: 'relative', minHeight: '500px' }}>
            <h2 className={styles.resultsTitle}>Battle Result</h2>
            <div className={styles.battleText}>{battleLog}</div>

            <div className="plugin-canvas" style={{ position: 'absolute', top: '100px', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              {pluginButtons.map((btn, i) => (
                <div key={`btn-${i}`} style={{ 
                  position: 'absolute', 
                  left: `${btn.x || 0}px`, 
                  top: `${btn.y || 0}px`, 
                  width: `${btn.width || 120}px`, 
                  height: `${btn.height || 40}px`,
                  pointerEvents: 'auto'
                }}>
                  <Button onClick={() => handlePluginButtonClick(btn.nodeId)} style={{ width: '100%', height: '100%' }}>
                    {btn.label}
                  </Button>
                </div>
              ))}

              {pluginLogs.map((log, i) => (
                <div key={`log-${i}`} style={{ 
                  position: 'absolute', 
                  left: `${log.x || 0}px`, 
                  top: `${log.y || 0}px`, 
                  width: `${log.width || 600}px`, 
                  height: `${log.height || 150}px`,
                  padding: log.mode === 'box' ? '1.5rem' : '0',
                  background: log.mode === 'box' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  borderLeft: log.mode === 'box' ? '4px solid #2563eb' : 'none',
                  borderRadius: '8px',
                  overflow: 'auto',
                  pointerEvents: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Battle Settings</h2>
            <form onSubmit={saveSettingsForm}>
              <div className={styles.formGroup}>
                <label>API Provider</label>
                <select value={provider} onChange={e => setProvider(e.target.value as any)} className={styles.input}>
                  <option value="google">Google AI</option>
                  <option value="lightning">Lightning AI</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Model Name</label>
                <input type="text" value={model} onChange={e => setModel(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.formGroup}>
                <label>Temperature ({temperature})</label>
                <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
              </div>
              <div className={styles.formGroup}>
                <label>System Instruction (Battle Rules)</label>
                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className={styles.textarea} style={{ minHeight: '150px' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <Button variant="secondary" type="button" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
            
            <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
              <h3>Instruction Presets</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {presets.map(p => (
                  <div key={p.id} className={styles.presetCard}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="secondary" onClick={() => handleSelectPreset(p)}>Load</Button>
                      <Button variant="secondary" onClick={() => deletePreset(p.id)} style={{ color: '#ef4444' }}>Del</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Save Current as New Preset</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} className={styles.input} placeholder="Preset Name" />
                  <Button onClick={handleSaveNewPreset} disabled={!newPresetName.trim()}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading Arena...</div>}>
      <HomeContent />
    </Suspense>
  );
}
