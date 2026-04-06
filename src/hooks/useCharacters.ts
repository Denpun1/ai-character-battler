import { useState, useEffect } from 'react';
import type { Character } from '@/types/character';

const STORAGE_KEY = 'ai_character_battler_roster';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCharacters(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse characters from local storage', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveCharacters = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCharacters));
  };

  const addCharacter = (name: string, skills: string, color: string = 'var(--primary)') => {
    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name,
      skills,
      color,
      createdAt: Date.now(),
    };
    saveCharacters([...characters, newCharacter]);
    return newCharacter;
  };

  const deleteCharacter = (id: string) => {
    saveCharacters(characters.filter(c => c.id !== id));
  };

  return {
    characters,
    isLoaded,
    addCharacter,
    deleteCharacter,
  };
}
