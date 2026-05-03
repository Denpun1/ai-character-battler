
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
      // 常に最新のModデータを取得して実行する（エディタでの更新を即座に反映させるため）
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
            setActiveMod(currentMod); // ローカルステートも更新
          } else {
            currentMod = null;
          }
        } catch (err) {
          console.error('[PluginManager] Failed to fetch latest mod', err);
        }
      }

      if (!currentMod) {
        console.log("No active mod found in PluginManager!");
        return;
      }
      const { triggerType, contextOverride, startNodeId } = e.detail;
      
      const context: PluginContext = {
        userId: user?.id || '',
        battleResult: battleResult || contextOverride?.battleResult,
        systemPrompt: systemPrompt || '',
        variables: variables // 現在の変数を渡す
      };

      // 実行後の変数を取得して永続化する
      await runPluginFlow(
        currentMod.flow_data.nodes, 
        currentMod.flow_data.edges, 
        triggerType, 
        context,
        startNodeId
      );
      
      // 注意: runPluginFlow内でcontext.variablesを直接変更しているため、
      // 参照渡しにより自動的に更新されますが、Reactの再レンダリングを促すためにステートも更新
      setVariables({ ...context.variables });
    };

    window.addEventListener('plugin:run', handleRun);
    return () => window.removeEventListener('plugin:run', handleRun);
  }, [activeMod, user, battleResult]);

  return null; // Logic only component
}
