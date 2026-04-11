import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import { Item } from '@/types/item';

export function useItems() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      setIsLoaded(true);
      return;
    }

    if (data) {
      const mapped: Item[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        createdAt: Number(item.created_at)
      }));
      setItems(mapped);
    }
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (authLoaded && userId) {
      fetchItems();
    } else if (authLoaded && !userId) {
      setItems([]);
      setIsLoaded(true);
    }
  }, [authLoaded, userId, fetchItems]);

  const addItem = async (name: string, description: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        name,
        description,
        created_at: Date.now()
      })
      .select();

    if (error) {
      console.error('Error adding item:', error);
      return;
    }
    
    if (data) {
      fetchItems();
    }
  };

  const editItem = async (id: string, name: string, description: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('items')
      .update({
        name,
        description
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error editing item:', error);
      return;
    }
    fetchItems();
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting item:', error);
      return;
    }
    fetchItems();
  };

  return {
    items,
    isLoaded: isLoaded && authLoaded,
    addItem,
    editItem,
    deleteItem,
  };
}
