import { useState, useEffect } from 'react';
import { Item } from '@/types/item';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@clerk/nextjs';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { userId } = useAuth();

  useEffect(() => {
    async function fetchItems() {
      if (!userId) {
        setItems([]);
        setIsLoaded(true);
        return;
      }
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped = data.map(d => ({
          id: d.id,
          name: d.name,
          description: d.description,
          createdAt: new Date(d.created_at).getTime(),
        }));
        setItems(mapped);
      } else {
        console.error('Fetch items error', error);
      }
      setIsLoaded(true);
    }
    fetchItems();
  }, [userId]);

  const addItem = async (name: string, description: string) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('items')
      .insert([{ user_id: userId, name, description }])
      .select()
      .single();

    if (!error && data) {
      setItems([...items, {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: new Date(data.created_at).getTime(),
      }]);
    }
  };

  const editItem = async (id: string, name: string, description: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('items')
      .update({ name, description })
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, name, description } : item));
    }
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  return {
    items,
    isLoaded,
    addItem,
    editItem,
    deleteItem,
  };
}
