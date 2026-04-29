
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';

export function useBattleRealtime() {
  const { user } = useUser();

  const handleUpdate = useCallback((payload: any) => {
    const newItem = payload.new;
    const oldItem = payload.old;

    console.log(`[Queue] ID: ${newItem.id} | Status: ${oldItem?.status || 'N/A'} -> ${newItem.status}`);

    if (newItem.status === 'processing') {
      window.dispatchEvent(new CustomEvent('battleStatusChange', { 
        detail: { id: newItem.id, status: 'processing', message: '対戦を生成しています...' } 
      }));
    }

    if (newItem.status === 'completed') {
      window.dispatchEvent(new CustomEvent('battleStatusChange', { 
        detail: { 
          id: newItem.id, 
          status: 'completed', 
          resultId: newItem.result_id, 
          winner: newItem.winner_name,
          message: '対戦が完了しました！' 
        } 
      }));
    }

    if (newItem.status === 'failed') {
      window.dispatchEvent(new CustomEvent('battleStatusChange', { 
        detail: { id: newItem.id, status: 'failed', message: `失敗: ${newItem.error_msg || '不明なエラー'}` } 
      }));
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`battle_queue_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'battle_queue',
          filter: `user_id=eq.${user.id}`
        },
        handleUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleUpdate]);
}
