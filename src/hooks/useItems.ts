import { useState, useEffect } from 'react';
import { Item } from '@/types/item';

const STORAGE_KEY = 'ai_character_battler_items';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse items', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveItems = (newItems: Item[]) => {
    setItems(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  };

  const addItem = (name: string, description: string) => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: Date.now(),
    };
    saveItems([...items, newItem]);
  };

  const editItem = (id: string, name: string, description: string) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, name, description } : item
    );
    saveItems(newItems);
  };

  const deleteItem = (id: string) => {
    saveItems(items.filter(item => item.id !== id));
  };

  return {
    items,
    isLoaded,
    addItem,
    editItem,
    deleteItem,
  };
}
