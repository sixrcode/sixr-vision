
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback } from 'react';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';
// WHY: Import the Zustand store to enable shadow mode synchronization.
// This allows us to write to Zustand whenever the React Context state changes,
// facilitating a gradual migration and testing of the Zustand store.
import { useSettingsStore } from '@/store/settingsStore';

type SettingsContextType = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    // WHY: Implement shadow mode synchronization to Zustand.
    // If the feature flag NEXT_PUBLIC_USE_ZUSTAND is set to 'shadow',
    // any update to the React Context settings will also be mirrored
    // to the Zustand store. This helps ensure data consistency during the
    // migration period and allows parts of the app to start reading from
    // Zustand while writes are still managed centrally here.
    if (process.env.NEXT_PUBLIC_USE_ZUSTAND === 'shadow') {
      // console.log(`[SettingsProvider SHADOW] Mirroring update to Zustand: ${String(key)} =`, value);
      useSettingsStore.getState().updateSetting(key, value);
    }
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);

    // WHY: Implement shadow mode synchronization for reset.
    // Similar to updateSetting, if in 'shadow' mode, resetting the React Context
    // settings will also trigger a reset in the Zustand store.
    if (process.env.NEXT_PUBLIC_USE_ZUSTAND === 'shadow') {
      // console.log('[SettingsProvider SHADOW] Mirroring reset to Zustand');
      useSettingsStore.getState().resetSettings();
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // WHY: This error ensures that useSettings is only called within components