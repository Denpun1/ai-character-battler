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
  thinkingLevel: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  provider: 'google' | 'lightning';
  jsonMode: boolean;
}

export interface SettingPreset extends Settings {
  id: string;
  name: string;
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: '',
  model: 'gemma-4-31b-it',
  temperature: 0.7,
  showThinking: false,
  thinkingBudget: 0,
  thinkingLevel: 'HIGH',
  provider: 'google',
  jsonMode: true,
};

export function useSettings() {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState<SettingPreset[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('setting_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setPresets(data.map(d => ({
        id: d.id,
        name: d.name,
        systemPrompt: d.system_prompt,
        model: d.model,
        temperature: d.temperature,
        showThinking: d.show_thinking,
        thinkingBudget: d.thinking_budget,
        thinkingLevel: d.thinking_level || 'HIGH',
        provider: d.provider,
        jsonMode: d.json_mode ?? true
      })));
    }
  }, [userId]);

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
        thinkingLevel: data.thinking_level || DEFAULT_SETTINGS.thinkingLevel,
        provider: data.provider || DEFAULT_SETTINGS.provider,
        jsonMode: data.json_mode ?? DEFAULT_SETTINGS.jsonMode,
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
      fetchPresets();
    }
  }, [authLoaded, userId, fetchSettings, fetchPresets]);

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
          thinking_level: newSettings.thinkingLevel,
          provider: newSettings.provider,
          json_mode: newSettings.jsonMode,
          created_at: Date.now()
        });

      if (error) {
        console.error('Error saving settings to cloud:', error);
        alert('Failed to save settings: ' + error.message);
      } else {
        console.log('Settings saved to cloud');
      }
    }
  };

  const createPreset = async (name: string, payload: Settings) => {
    if (!userId) return;
    await supabase.from('setting_presets').insert({
      user_id: userId,
      name,
      system_prompt: payload.systemPrompt,
      model: payload.model,
      temperature: payload.temperature,
      show_thinking: payload.showThinking,
      thinking_budget: payload.thinkingBudget,
      thinking_level: payload.thinkingLevel,
      provider: payload.provider,
      created_at: Date.now()
    });
    fetchPresets();
  };

  const deletePreset = async (id: string) => {
    await supabase.from('setting_presets').delete().eq('id', id);
    fetchPresets();
  };

  return {
    settings,
    presets,
    isLoaded: isLoaded && authLoaded,
    saveSettings,
    createPreset,
    deletePreset
  };
}
