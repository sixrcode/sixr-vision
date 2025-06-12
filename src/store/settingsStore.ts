
// WHY: This file establishes the new Zustand store for application settings.
// It centralizes state logic, making it more maintainable and performant
// compared to solely relying on React Context for a large settings object.
// Using Zustand allows for selective subscriptions to state slices, reducing unnecessary re-renders.

import { create } from 'zustand';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

// Define the interface for the store's state and actions
interface SettingsState extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

// Create the Zustand store
export const useSettingsStore = create<SettingsState>((set) => ({
  // WHY: Initialize the store with default settings.
  // Spreading DEFAULT_SETTINGS ensures all settings are present from the start.
  ...DEFAULT_SETTINGS,

  // WHY: Provides a typed action to update a specific setting.
  // This is more granular than updating the entire settings object,
  // allowing components to subscribe only to the settings they need.
  updateSetting: (key, value) =>
    set((state) => {
      // WHY: Logging state changes can be helpful during development and debugging.
      // console.log(`[Zustand SettingsStore] Updating ${String(key)} from`, state[key], 'to', value);
      return { ...state, [key]: value };
    }),

  // WHY: Provides an action to reset all settings to their default values.
  // This is useful for user-initiated resets or application initialization.
  resetSettings: () =>
    set(() => {
      // WHY: Logging the reset action.
      // console.log('[Zustand SettingsStore] Resetting settings to default');
      return DEFAULT_SETTINGS;
    }),
}));

// Optional: A selector for convenience if you often need the whole settings object (without actions)
// export const selectAllSettings = (state: SettingsState): Settings => {
//   const { updateSetting, resetSettings,