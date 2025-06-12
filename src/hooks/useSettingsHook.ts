
"use client";

import { useSettingsStore } from '@/store/settingsStore';
import type { Settings } from '@/types/state'; // Assuming Settings is the primary state type

/**
 * Custom hook to select parts of the settings state from the Zustand store.
 * This provides a dedicated hook for accessing settings, similar to how
 * one might use a context hook, but leveraging Zustand's selectors.
 *
 * @template T - The type of the selected state slice.
 * @param {(state: Settings) => T} selector - A function that selects a slice of the state.
 * @returns {T} The selected state slice.
 *
 * @example
 * const fftSize = useSettingsHook(state => state.fftSize);
 * const { gain, enableAgc } = useSettingsHook(state => ({ gain: state.gain, enableAgc: state.enableAgc }));
 */
export function useSettingsHook<T>(
  selector: (state: Settings) => T
): T {
  return useSettingsStore(selector);
}

// Example of a hook that returns the entire state (though generally discouraged for performance)
// export function useAllSettings(): Settings {
//   return useSettingsStore((state) => state);
// }

// Example of a hook that returns specific update actions
// export function useSettingsActions() {
//   return useSettingsStore((state) => ({
//     updateSetting: state.updateSetting,
//     resetSettings: state.resetSettings,
//     updateLogoAnimationSetting: state.updateLogoAnimationSetting,
//   }));
// }
