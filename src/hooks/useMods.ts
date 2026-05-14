
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface LayoutElement {
  id: string;
  type: 'text' | 'input' | 'button' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  binding?: string;
}

export interface Mod {
  id: string;
  name: string;
  flow_data: any;
  layout_data: LayoutElement[];
  is_active: boolean;
  user_id: string;
}

export function useMods(userId: string | undefined) {
  const [mods, setMods] = useState<Mod[]>([]);
  const [activeModId, setActiveModId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchMods = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('mods').select('*').eq('user_id', userId);
    if (data) {
        setMods(data);
        if (data.length > 0 && !activeModId) setActiveModId(data[0].id);
    }
    setIsLoaded(true);
  }, [userId, activeModId]);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  const saveMod = async (mod: Partial<Mod>) => {
    if (!userId || !mod.id) return;
    await supabase.from('mods').update(mod).eq('id', mod.id);
    fetchMods();
  };

  const createMod = async (name: string) => {
    if (!userId) return;
    const { data } = await supabase.from('mods').insert({
      user_id: userId,
      name,
      flow_data: { nodes: [], edges: [] },
      layout_data: [],
      is_active: false
    }).select().single();
    if (data) {
        setMods([...mods, data]);
        setActiveModId(data.id);
    }
  };

  return {
    mods,
    activeModId,
    setActiveModId,
    saveMod,
    createMod,
    isLoaded
  };
}
