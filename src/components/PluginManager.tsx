
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { runPluginFlow, PluginContext } from '@/lib/pluginInterpreter';
import { useUser } from '@clerk/nextjs';

export function PluginManager({ 
  battleResult, 
  onEvent,
  systemPrompt
}: { 
  battleResult?: any, 
  onEvent?: (e: any) => void,
  systemPrompt?: string
}) {
  const { user } = useUser();
  const [activeMod, setActiveMod] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchActiveMod();
    }
  }, [user]);

  const fetchActiveMod = async () => {
    try {
      const { data, error } = await supabase
        .from('battle_mods')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .limit(1);
      
      if (error) {
        console.warn('[PluginManager] Fetch error (table might be missing):', error.message);
        return;
      }

      if (data && data.length > 0) {
        setActiveMod(data[0]);
      }
    } catch (err) {
      console.error('[PluginManager] Unexpected error:', err);
    }
  };

  // Listen for external triggers to run flow
  useEffect(() => {
    const handleRun = async (e: any) => {
      if (!activeMod) return;
      const { triggerType, contextOverride, startNodeId } = e.detail;
      
      const context: PluginContext = {
        userId: user?.id || '',
        battleResult: battleResult || contextOverride?.battleResult,
        systemPrompt: systemPrompt || '',
        variables: {}
      };

      await runPluginFlow(
        activeMod.flow_data.nodes, 
        activeMod.flow_data.edges, 
        triggerType, 
        context,
        startNodeId
      );
    };

    window.addEventListener('plugin:run', handleRun);
    return () => window.removeEventListener('plugin:run', handleRun);
  }, [activeMod, user, battleResult]);

  return null; // Logic only component
}
