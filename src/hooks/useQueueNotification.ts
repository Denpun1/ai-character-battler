
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@clerk/nextjs';

export function useQueueNotification() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    console.log('useQueueNotification: Subscribing to battle_queue for user', user.id);
    const channel = supabase
      .channel(`queue_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'battle_queue',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('useQueueNotification: Received payload', payload);
          const newItem = payload.new as any;
          
          if (newItem.status === 'completed') {
            console.log('useQueueNotification: Battle completed!', newItem.id);
            const event = new CustomEvent('battleCompleted', { 
              detail: { 
                id: newItem.id, 
                resultId: newItem.result_id,
                winner: newItem.winner_name 
              } 
            });
            window.dispatchEvent(event);
          }
          
          if (newItem.status === 'failed') {
             console.log('useQueueNotification: Battle failed', newItem.error_msg);
             const event = new CustomEvent('battleFailed', { 
              detail: { message: newItem.error_msg } 
            });
            window.dispatchEvent(event);
          }
        }
      )
      .subscribe((status) => {
        console.log('useQueueNotification: Subscription status', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
