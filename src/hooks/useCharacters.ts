import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { Character } from '@/types/character';

export interface CharacterVariant {
  id: string;
  characterId: string;
  name: string | null;
  description: string;
  isBackup: boolean;
  createdAt: number;
}

export function useCharacters() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchCharacters = useCallback(async () => {
    if (!userId) return;
    
    // We get uuid from DB, so we map it to our Character type
    // In SQL Editor we created character table with camel_case or snake_case?
    // User plan SQL: id, user_id, name, skills, item_id, color, created_at
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching characters:', error);
      setIsLoaded(true);
      return;
    }

    if (data) {
      // Map database fields (snake_case) to Character type (camelCase)
      const mapped: Character[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        name: item.name,
        description: item.skills,
        itemId: item.item_id,
        color: item.color,
        created_at: Number(item.created_at)
      }));
      setCharacters(mapped);
    }
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (authLoaded && userId) {
      fetchCharacters();
    } else if (authLoaded && !userId) {
      setCharacters([]);
      setIsLoaded(true);
    }
  }, [authLoaded, userId, fetchCharacters]);

  const addCharacter = async (name: string, description: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name,
        skills: description,
        item_id: itemId === '' ? null : itemId,
        color,
        created_at: Date.now()
      })
      .select();

    if (error) {
      console.error('Error adding character:', error);
      return;
    }
    
    if (data) {
      fetchCharacters(); // Refresh the list
    }
  };

  const editCharacter = async (id: string, name: string, description: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;

    // Fetch existing character to see if description changed
    const existing = characters.find(c => c.id === id);
    if (existing && existing.description !== description) {
      // Auto-save backup
      await supabase.from('character_variants').insert({
        user_id: userId,
        character_id: id,
        name: `Backup: ${new Date().toLocaleString()}`,
        skills: existing.description,
        is_backup: true,
        created_at: Date.now()
      });
    }

    const { error } = await supabase
      .from('characters')
      .update({
        name,
        skills: description,
        item_id: itemId === '' ? null : itemId,
        color
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error editing character:', error);
      return;
    }
    fetchCharacters();
  };

  const deleteCharacter = async (id: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting character:', error);
      return;
    }
    fetchCharacters();
  };

  const fetchVariants = async (characterId: string): Promise<CharacterVariant[]> => {
    if (!userId) return [];
    const { data } = await supabase
      .from('character_variants')
      .select('*')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });

    if (!data) return [];
    return data.map((d: any) => ({
      id: d.id,
      characterId: d.character_id,
      name: d.name,
      description: d.skills,
      isBackup: d.is_backup,
      createdAt: Number(d.created_at)
    }));
  };

  const saveVariant = async (characterId: string, name: string, description: string) => {
    if (!userId) return;
    await supabase.from('character_variants').insert({
      user_id: userId,
      character_id: characterId,
      name,
      skills: description,
      is_backup: false,
      created_at: Date.now()
    });
  };

  const deleteVariant = async (variantId: string) => {
    if (!userId) return;
    await supabase.from('character_variants').delete().eq('id', variantId);
  };

  return {
    characters,
    isLoaded: isLoaded && authLoaded,
    addCharacter,
    editCharacter,
    deleteCharacter,
    fetchVariants,
    saveVariant,
    deleteVariant
  };
}
