import { useState, useEffect } from 'react';
import { Character } from '@/types/character';

const STORAGE_KEY = 'ai_character_battler_data';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCharacters(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse characters', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveCharacters = (newCharacters: Character[]) => {
    setCharacters(newCharacters);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCharacters));
  };

  const addCharacter = (name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name,
      skills,
      itemId,
      color,
      createdAt: Date.now(),
    };
    saveCharacters([...characters, newCharacter]);
  };

  const editCharacter = (id: string, name: string, skills: string, itemId: string = '', color: string = 'var(--primary)') => {
    const newCharacters = characters.map(char => 
      char.id === id ? { ...char, name, skills, itemId, color } : char
    );
    saveCharacters(newCharacters);
  };

  const deleteCharacter = (id: string) => {
    saveCharacters(characters.filter(char => char.id !== id));
  };

  return {
    characters,
    isLoaded,
    addCharacter,
    editCharacter,
    deleteCharacter,
  };
}
