
// WHY: This file establishes the new Zustand store for application settings.
// It centralizes state logic, making it more maintainable and performant
// compared to solely relying on React Context for a large settings object.
// Using Zustand allows for selective subscriptions to state slices, reducing unnecessary re-renders.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware'; // WHY: Import the devtools middleware to connect the store to browser devtools.
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

// Define the interface for the store's state and actions
interface SettingsState extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

// Create the Zustand store, now wrapped with devtools.
// WHY: Wrapping with devtools allows the store's state and actions to be inspected
// using browser extensions like Redux DevTools. This is invaluable for debugging.
export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set) => ({
      // WHY: Initialize the store with default settings.
      // Spreading DEFAULT_SETTINGS ensures all settings are present from the start.
      ...DEFAULT_SETTINGS,

      // WHY: Provides a typed action to update a specific setting.
      // The third argument to `set` (e.g., `updateSetting/${String(key)}`) is an action type
      // that will appear in the devtools, making it easier to trace how state changed.
      updateSetting: (key, value) =>
        set(
          (state) => {
            // console.log(`[Zustand SettingsStore] Updating ${String(key)} from`, state[key], 'to', value);
            return { ...state, [key]: value };
          },
          false, // false tells Zustand to merge state rather than replace it.
          `updateSetting/${String(key)}` // WHY: This string serves as an action type for the DevTools.
        ),

      // WHY: Provides an action to reset all settings to their default values.
      resetSettings: () =>
        set(
          () => {
            // console.log('[Zustand SettingsStore] Resetting settings to default');
            return DEFAULT_SETTINGS;
          },
          false, // false tells Zustand to merge state rather than replace it.
          'resetSettings' // WHY: Action type for the DevTools.
        ),
    }),
    {
      name: 'SIXRVisionSettingsStore', // WHY: This name will identify your store in the DevTools extension.
      enabled: process.env.NODE_ENV === 'development', // WHY: Optionally enable devtools only in development.
    }
  )
);
