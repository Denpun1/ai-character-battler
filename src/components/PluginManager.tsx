
'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { runPluginFlow, PluginContext } from '@/lib/pluginInterpreter';
import { useUser } from '@clerk/nextjs';

export function PluginManager({ battleResult, onEvent }: { battleResult?: any, onEvent?: (e: any) => void }) {
  const { user } = useUser();
  const [activeMod, setActiveMod] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchActiveMod();
    }
  }, [user]);

  const fetchActiveMod = async () => {
    const { data } = await supabase
      .from('battle_mods')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .single();
    
    if (data) setActiveMod(data);
  };

  // Listen for external triggers to run flow
  useEffect(() => {
    const handleRun = async (e: any) => {
      if (!activeMod) return;
      const { triggerType, contextOverride } = e.detail;
      
      const context: PluginContext = {
        userId: user?.id || '',
        battleResult: battleResult || contextOverride?.battleResult,
        variables: {}
      };

      await runPluginFlow(
        activeMod.flow_data.nodes, 
        activeMod.flow_data.edges, 
        triggerType, 
        context
      );
    };

    window.addEventListener('plugin:run', handleRun);
    return () => window.removeEventListener('plugin:run', handleRun);
  }, [activeMod, user, battleResult]);

  return null; // Logic only component
}
