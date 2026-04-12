import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'ai_character_battler_settings';

export interface Settings {
  systemPrompt: string;
  model: string;
  temperature: number;
  showThinking: boolean;
  thinkingBudget: number;
  provider: 'google' | 'lightning';
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: '以下の2人のキャラクターが熱いバトルを行います。設定に基づいて、臨場感のある劇的なバトルの展開と、最終的にどちらが勝つかを決定し、シナリオを出力してください。文章は小説のようなトーンで作成してください。出力要件: 1. バトル開始の状況 2. スキル・アイテムを駆使した攻防 3. クライマックス 4. 明確な勝者の宣言（最後に「勝者: [キャラクター名]」という形式で終わること）',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  showThinking: false,
  thinkingBudget: 0,
  provider: 'google',
};

export function useSettings() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!userId) {
      // Load from local storage for non-logged in users
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        } catch (e) {
          console.error('Failed to parse local settings', e);
        }
      }
      setIsLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error('Error fetching settings:', error);
    }

    if (data) {
      setSettings({
        systemPrompt: data.system_prompt || DEFAULT_SETTINGS.systemPrompt,
        model: data.model || DEFAULT_SETTINGS.model,
        temperature: data.temperature ?? DEFAULT_SETTINGS.temperature,
        showThinking: data.show_thinking ?? DEFAULT_SETTINGS.showThinking,
        thinkingBudget: data.thinking_budget ?? DEFAULT_SETTINGS.thinkingBudget,
        provider: data.provider || DEFAULT_SETTINGS.provider,
      });
    } else {
      // If no cloud data, use local storage as potential migration source
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const localSettings = JSON.parse(stored);
          setSettings(prev => ({ ...prev, ...localSettings }));
          // Auto-sync local to cloud if first time
          saveSettings({ ...DEFAULT_SETTINGS, ...localSettings });
        } catch (e) {}
      }
    }
    setIsLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (authLoaded) {
      fetchSettings();
    }
  }, [authLoaded, userId, fetchSettings]);

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    // Always save to local as backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));

    if (userId) {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          system_prompt: newSettings.systemPrompt,
          model: newSettings.model,
          temperature: newSettings.temperature,
          show_thinking: newSettings.showThinking,
          thinking_budget: newSettings.thinkingBudget,
          provider: newSettings.provider,
          created_at: Date.now()
        });

      if (error) {
        console.error('Error saving settings to cloud:', error);
      }
    }
  };

  return {
    settings,
    isLoaded: isLoaded && authLoaded,
    saveSettings,
  };
}
