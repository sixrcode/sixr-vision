
"use client";

import { useAudioDataStore } from '@/store/audioDataStore';
import type { AudioData } from '@/types/state';

/**
 * Custom hook to select parts of the audio data state from the Zustand store.
 *
 * @template T - The type of the selected state slice.
 * @param {(state: AudioData) => T} selector - A function that selects a slice of the state.
 * @returns {T} The selected state slice.
 *
 * @example
 * const rms = useAudioDataHook(state => state.rms);
 * const { bassEnergy, beat } = useAudioDataHook(state => ({ bassEnergy: state.bassEnergy, beat: state.beat }));
 */
export function useAudioDataHook<T>(
  selector: (state: AudioData) => T
): T {
  return useAudioDataStore(selector);
}

// Example of a hook that returns specific update actions
// export function useAudioDataActions() {
//   return useAudioDataStore((state) => ({
//     setAudioData: state.setAudioData,
//     resetAudioData: state.resetAudioData,
//   }));
// }
