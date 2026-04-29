
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';
import styles from '../page.module.css'; // Reuse existing styles for consistency
import { Plus, Edit2, Play, Trash2, Box } from 'lucide-react';
import { Button } from '@/components/Button';
import { useRouter } from 'next/navigation';

interface BattleMod {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: number;
}

export default function PluginsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [mods, setMods] = useState<BattleMod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[Plugins] Auth state:', { isLoaded, userId: user?.id });
    if (isLoaded && user) {
      fetchMods();
    }
  }, [isLoaded, user]);

  const fetchMods = async () => {
    try {
      const { data, error } = await supabase
        .from('battle_mods')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Fetch mods error:', error);
      } else if (data) {
        setMods(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching mods:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMod = async (id: string, currentStatus: boolean) => {
    // If enabling, disable all others first (only one active mod for now)
    if (!currentStatus) {
      await supabase.from('battle_mods').update({ is_active: false }).eq('user_id', user?.id);
    }

    const { error } = await supabase
      .from('battle_mods')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (!error) fetchMods();
  };

  const deleteMod = async (id: string) => {
    if (!confirm('このプラグインを削除してもよろしいですか？')) return;
    const { error } = await supabase.from('battle_mods').delete().eq('id', id);
    if (!error) fetchMods();
  };

  const createNewMod = async () => {
    console.log('[Plugins] Create button clicked');
    if (!user) {
      alert('ログイン情報が読み込まれていません。再試行してください。');
      return;
    }
    
    const name = `Plugin ${mods.length + 1}`;
    console.log('[Plugins] Creating mod with name:', name);

    try {
      const { data, error } = await supabase.from('battle_mods').insert({
        user_id: user.id,
        name,
        description: 'A custom battle mod.',
        flow_data: { nodes: [], edges: [] },
        is_active: false
      }).select().single();

      if (error) {
        alert('プラグインの作成に失敗しました: ' + error.message);
        console.error('Create error:', error);
      } else if (data) {
        console.log('[Plugins] Created successfully, redirecting to editor with id:', data.id);
        router.push(`/plugins/editor?id=${data.id}`);
      }
    } catch (err) {
      console.error('[Plugins] Unexpected exception:', err);
      alert('予期せぬエラーが発生しました');
    }
  };

  if (!isLoaded) return <div style={{ color: 'white', padding: '2rem' }}>Loading authentication...</div>;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className={styles.title} style={{ margin: 0 }}>Plugins <span style={{ fontSize: '1rem', opacity: 0.6 }}>(Mod System)</span></h1>
            <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>対戦のルールやUIを自由にカスタマイズするプラグインを管理します。</p>
          </div>
          <Button type="button" onClick={createNewMod} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} /> 新規作成
          </Button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {mods.map(mod => (
            <div key={mod.id} style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '1.5rem',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{mod.name}</h3>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.6 }}>{mod.description}</p>
                </div>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  background: mod.is_active ? '#059669' : 'rgba(255,255,255,0.1)',
                  color: 'white'
                }}>
                  {mod.is_active ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                <Link href={`/plugins/editor?id=${mod.id}`} style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'white',
                  fontSize: '0.9rem'
                }}>
                  <Edit2 size={16} /> 編集
                </Link>
                <button 
                  onClick={() => toggleMod(mod.id, mod.is_active)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    background: mod.is_active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                    border: `1px solid ${mod.is_active ? '#ef4444' : '#059669'}`,
                    borderRadius: '8px',
                    color: mod.is_active ? '#ef4444' : '#059669',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  {mod.is_active ? '無効化' : '有効化'}
                </button>
                <button 
                  onClick={() => deleteMod(mod.id)}
                  style={{
                    padding: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {mods.length === 0 && !isLoading && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <Box size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ opacity: 0.5 }}>プラグインがまだありません。「新規作成」から最初のModを作りましょう。</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
