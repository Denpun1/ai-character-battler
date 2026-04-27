import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

export interface RouletteItem {
  id: string;
  label: string;
  color: string;
  weight: number;
}

export interface RoulettePreset {
  id: string;
  name: string;
  items: RouletteItem[];
}

export function useRoulettes() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [presets, setPresets] = useState<RoulettePreset[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('roulettes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setPresets(data.map(d => ({
        id: d.id,
        name: d.name,
        items: d.items
      })));
    }
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (authLoaded) {
      fetchPresets();
    }
  }, [authLoaded, fetchPresets]);

  const savePreset = async (name: string, items: RouletteItem[]) => {
    if (!userId) return;
    await supabase.from('roulettes').insert({
      user_id: userId,
      name,
      items,
      created_at: Date.now()
    });
    fetchPresets();
  };

  const deletePreset = async (id: string) => {
    if (!userId) return;
    await supabase.from('roulettes').delete().eq('id', id);
    fetchPresets();
  };

  return { presets, isLoaded: isLoaded && authLoaded, savePreset, deletePreset };
}
