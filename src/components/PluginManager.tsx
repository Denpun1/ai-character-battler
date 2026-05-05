
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
  const [variables, setVariables] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user) {
      // 初期ロード
      const fetchInitial = async () => {
        const { data } = await supabase
          .from('battle_mods')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);
        if (data && data.length > 0) setActiveMod(data[0]);
      };
      fetchInitial();
    }
  }, [user]);

  // Listen for external triggers to run flow
  useEffect(() => {
    const handleRun = async (e: any) => {
      const { triggerType, contextOverride, startNodeId } = e.detail;
      
      // 常に最新のModデータを取得して実行する
      let currentMod = activeMod;
      if (user) {
        try {
          const { data } = await supabase
            .from('battle_mods')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1);
          if (data && data.length > 0) {
            currentMod = data[0];
            setActiveMod(currentMod);
          }
        } catch (err) {
          console.error('[PluginManager] Failed to fetch latest mod', err);
        }
      }

      if (!currentMod) {
        console.log("No active mod found in PluginManager!");
        return;
      }
      
      // 実行コンテキストの構築
      const context: PluginContext = {
        userId: user?.id || '',
        battleResult: contextOverride?.battleResult || battleResult,
        systemPrompt: systemPrompt || '',
        variables: variables // 既存の変数を引き継ぐ
      };

      // 実行
      await runPluginFlow(
        currentMod.flow_data.nodes, 
        currentMod.flow_data.edges, 
        triggerType, 
        context,
        startNodeId
      );
      
      // 実行後の変数をステートに保存して永続化
      setVariables({ ...context.variables });
    };

    window.addEventListener('plugin:run', handleRun);
    
    const handleReset = () => {
      setVariables({});
      console.log("[PluginManager] Variables reset.");
    };
    window.addEventListener('plugin:reset', handleReset);

    return () => {
      window.removeEventListener('plugin:run', handleRun);
      window.removeEventListener('plugin:reset', handleReset);
    };
  }, [activeMod, user, battleResult, variables, systemPrompt]);

  return null; // Logic only component
}
