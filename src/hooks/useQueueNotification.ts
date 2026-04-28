
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';

export function useQueueNotification() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    // Listen for updates to the battle_queue table for THIS user
    const channel = supabase
      .channel('queue_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_queue',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newItem = payload.new as any;
          const oldItem = payload.old as any;

          // Detect transition to completed
          if (newItem.status === 'completed' && oldItem.status !== 'completed') {
            // We show a browser notification or a simple alert for now
            // To be more "premium", we'll dispatch a custom event
            const event = new CustomEvent('battleCompleted', { 
              detail: { 
                id: newItem.id, 
                resultId: newItem.result_id,
                winner: newItem.winner_name 
              } 
            });
            window.dispatchEvent(event);
          }
          
          if (newItem.status === 'failed' && oldItem.status !== 'failed') {
             const event = new CustomEvent('battleFailed', { 
              detail: { message: newItem.error_msg } 
            });
            window.dispatchEvent(event);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
