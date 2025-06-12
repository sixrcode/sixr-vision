
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
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

  // Shadow sync to Zustand store
  useEffect(() => {
    // Ensure this effect's logic only runs on the client and when shadow sync is enabled
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SHADOW_ZUSTAND === 'true') {
      // console.log('[SettingsProvider Shadow Sync] useEffect detected settings change. Syncing to Zustand:', settings);
      const zustandUpdate = useSettingsStore.getState().updateSetting;
      let hasChanges = false;
      for (const key in settings) {
        if (settings.hasOwnProperty(key)) {
          const K = key as keyof Settings;
          // Check if Zustand state actually differs to avoid redundant updates
          if (useSettingsStore.getState()[K] !== settings[K]) {
            zustandUpdate(K, settings[K]);
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        // console.log('[SettingsProvider Shadow Sync] Context changes synced to Zustand store.');
      }
    }
  }, [settings]); // This useEffect triggers whenever the context's `settings` state changes.


  const updateSettingCallback = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
    // Ensure direct Zustand update only happens on client and when shadow sync is enabled
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SHADOW_ZUSTAND === 'true') {
      // console.log(`[SettingsProvider Shadow Sync] Context updateSetting for ${String(key)}. Sending to Zustand.`);
      useSettingsStore.getState().updateSetting(key, value);
    }
  }, []);

  const resetSettingsCallback = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    // Ensure direct Zustand update only happens on client and when shadow sync is enabled
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SHADOW_ZUSTAND === 'true') {
       // console.log('[SettingsProvider Shadow Sync] Context resetSettings. Triggering Zustand reset.');
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
  if (!context) {
      console.error("CRITICAL: SettingsContext evaluated to undefined OR useSettings was called outside a provider. This indicates a severe problem with React Context setup or SSR. Falling back to default context.");
      return defaultContextValue;
  }
  return context;
}
