import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

const CHAR_STORAGE_KEY = 'ai_character_battler_data';
const ITEM_STORAGE_KEY = 'ai_character_battler_items';

export function useMigration() {
  const { userId } = useAuth();

  useEffect(() => {
    async function migrate() {
      if (!userId) return;

      const localItemsStr = localStorage.getItem(ITEM_STORAGE_KEY);
      const localCharsStr = localStorage.getItem(CHAR_STORAGE_KEY);

      if (!localItemsStr && !localCharsStr) return;

      console.log('Starting data migration to Supabase...');

      try {
        // 1. アイテムの移行
        if (localItemsStr) {
          const localItems = JSON.parse(localItemsStr);
          if (localItems.length > 0) {
            const itemsToInsert = localItems.map((it: any) => ({
              id: it.id,
              user_id: userId,
              name: it.name,
              description: it.description,
              created_at: it.createdAt || Date.now()
            }));

            const { error: itemError } = await supabase
              .from('items')
              .upsert(itemsToInsert, { onConflict: 'id' });

            if (itemError) throw itemError;
          }
          localStorage.removeItem(ITEM_STORAGE_KEY);
        }

        // 2. キャラクターの移行
        if (localCharsStr) {
          const localChars = JSON.parse(localCharsStr);
          if (localChars.length > 0) {
            const charsToInsert = localChars.map((char: any) => ({
              id: char.id,
              user_id: userId,
              name: char.name,
              skills: char.skills,
              item_id: char.itemId || null,
              color: char.color,
              created_at: char.createdAt || Date.now()
            }));

            const { error: charError } = await supabase
              .from('characters')
              .upsert(charsToInsert, { onConflict: 'id' });

            if (charError) throw charError;
          }
          localStorage.removeItem(CHAR_STORAGE_KEY);
        }

        console.log('Migration completed successfully.');
        // ページをリロードして最新データをDBから取得
        window.location.reload();

      } catch (e) {
        console.error('Migration failed:', e);
      }
    }

    migrate();
  }, [userId]);
}
