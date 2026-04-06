import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ai_character_battler_settings';

export interface Settings {
  systemPrompt: string;
  model: string;
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: '以下の2人のキャラクターが熱いバトルを行います。設定に基づいて、臨場感のある劇的なバトルの展開と、最終的にどちらが勝つかを決定し、シナリオを出力してください。文章は小説のようなトーンで作成してください。出力要件: 1. バトル開始の状況 2. スキル・アイテムを駆使した攻防 3. クライマックス 4. 明確な勝者の宣言（最後に「勝者: [キャラクター名]」という形式で終わること）',
  model: 'gemini-2.5-flash',
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  return {
    settings,
    isLoaded,
    saveSettings,
  };
}
