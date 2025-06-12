
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import { useSettingsStore } from '@/store/settingsStore';

type SettingsContextType = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
};

const defaultContextValue: SettingsContextType = {
  settings: DEFAULT_SETTINGS,
  updateSetting: () => console.warn('Default updateSetting called - SettingsProvider not yet mounted/available?'),
  resetSettings: () => console.warn('Default resetSettings called - SettingsProvider not yet mounted/available?'),
};

const SettingsContext = createContext<SettingsContextType>(defaultContextValue);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  const updateSettingCallback = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
    // Ensures shadow writes happen in pilot too if context is still used by some components, or if settings are updated directly via context
    if (process.env.NEXT_PUBLIC_USE_ZUSTAND === 'shadow' || process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot') {
      useSettingsStore.getState().updateSetting(key, value);
    }
  }, []);

  const resetSettingsCallback = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    if (process.env.NEXT_PUBLIC_USE_ZUSTAND === 'shadow' || process.env.NEXT_PUBLIC_USE_ZUSTAND === 'pilot') {
      useSettingsStore.getState().resetSettings();
    }
  }, []);

  const providerValue = useMemo(() => ({
    settings: settings,
    updateSetting: updateSettingCallback,
    resetSettings: resetSettingsCallback,
  }), [settings, updateSettingCallback, resetSettingsCallback]);

  return (
    <SettingsContext.Provider value={providerValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  // This check should be largely redundant if createContext has a default that matches the type,
  // but it's a safeguard. The primary issue arises if `useSettings` itself is undefined when imported.
  if (context === undefined) { // Should theoretically not happen with defaultContextValue
      console.error("CRITICAL: SettingsContext is undefined in useSettings. This implies createContext default was overridden or useSettings called outside Provider. Falling back to default context value.");
      return defaultContextValue;
  }
  return context;
}
    