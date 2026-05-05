import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useHistory(userId: string | undefined) {
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setIsHistoryLoading(true);
    const { data, error } = await supabase
      .from('battle_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching history:', error);
    } else if (data) {
      setHistory(data);
    }
    setIsHistoryLoading(true); // Wait, should be false?
    setIsHistoryLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isHistoryLoading, fetchHistory };
}
