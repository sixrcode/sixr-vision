
import { create, type StateCreator } from 'zustand';
// import { devtools } from 'zustand/middleware'; // Temporarily remove devtools
import type { Settings, LogoAnimationSettings } from '@/types/state';
import { DEFAULT_SETTINGS } from '@/lib/constants';

interface SettingsState extends Settings {
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateLogoAnimationSetting: <K extends keyof LogoAnimationSettings>(
    key: K,
    value: LogoAnimationSettings[K]
  ) => void;
  resetSettings: () => void;
}

const settingsStoreInitializer: StateCreator<SettingsState, [], []> = (set) => ({
  ...DEFAULT_SETTINGS,
  updateSetting: (key, value) =>
    set(
      (state) => {
        // console.log(`[Zustand SettingsStore] Updating ${String(key)} from`, state[key], 'to', value);
        return { ...state, [key]: value };
      },
      false,
      `settings/updateSetting/${String(key)}`
    ),
  updateLogoAnimationSetting: (key, value) =>
    set(
      (state) => ({
        logoAnimationSettings: {
          ...state.logoAnimationSettings,
          [key]: value,
        },
      }),
      false,
      `settings/updateLogoAnimationSetting/${String(key)}`
    ),
  resetSettings: () =>
    set(
      () => {
        // console.log('[Zustand SettingsStore] Resetting settings to default');
        return DEFAULT_SETTINGS;
      },
      false,
      'settings/resetSettings'
    ),
});

// Temporarily use the initializer directly without devtools for SSR diagnostics
export const useSettingsStore = create<SettingsState>(settingsStoreInitializer);

/*
// Original conditional logic for devtools:
const storeCreatorLogic =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
    ? devtools(settingsStoreInitializer, { name: 'SIXRVisionSettingsStore', store: 'settings' })
    : settingsStoreInitializer;

export const useSettingsStore = create<SettingsState>(storeCreatorLogic);
*/
