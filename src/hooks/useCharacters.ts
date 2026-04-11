import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { Character } from '@/types/character';

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
        name: item.name,
        skills: item.skills,
        itemId: item.item_id,
        color: item.color,
        createdAt: Number(item.created_at)
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

  const addCharacter = async (name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name,
        skills,
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

  const editCharacter = async (id: string, name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;

    const { error } = await supabase
      .from('characters')
      .update({
        name,
        skills,
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

  return {
    characters,
    isLoaded: isLoaded && authLoaded,
    addCharacter,
    editCharacter,
    deleteCharacter,
  };
}
