import { useState, useEffect } from 'react';
import { Character } from '@/types/character';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@clerk/nextjs';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    async function fetchCharacters() {
      if (!userId) {
        setCharacters([]);
        setIsLoaded(true);
        return;
      }
      
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped = data.map(d => ({
          id: d.id,
          name: d.name,
          skills: d.skills,
          itemId: d.item_id || undefined,
          color: d.color,
          createdAt: new Date(d.created_at).getTime(),
        }));
        setCharacters(mapped);
      } else {
        console.error('Fetch characters error', error);
      }
      setIsLoaded(true);
    }
    fetchCharacters();
  }, [userId]);

  const addCharacter = async (name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;
    
    const payload: any = {
      user_id: userId,
      name,
      skills,
      color
    };
    if (itemId) payload.item_id = itemId;

    const { data, error } = await supabase
      .from('characters')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      setCharacters([...characters, {
        id: data.id,
        name: data.name,
        skills: data.skills,
        itemId: data.item_id || undefined,
        color: data.color,
        createdAt: new Date(data.created_at).getTime(),
      }]);
    }
  };

  const editCharacter = async (id: string, name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    if (!userId) return;
    
    const payload: any = { name, skills, color, item_id: itemId || null };

    const { error } = await supabase
      .from('characters')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      setCharacters(characters.map(char => 
        char.id === id ? { ...char, name, skills, itemId: itemId || undefined, color } : char
      ));
    }
  };

  const deleteCharacter = async (id: string) => {
    if (!userId) return;
    
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      setCharacters(characters.filter(char => char.id !== id));
    }
  };

  return {
    characters,
    isLoaded,
    addCharacter,
    editCharacter,
    deleteCharacter,
  };
}
