
import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AudioData } from '@/types/state';
import { INITIAL_AUDIO_DATA } from '@/lib/constants';

interface AudioDataState extends AudioData {
  setAudioData: (data: Partial<AudioData>) => void;
  resetAudioData: () => void;
}

const audioDataStoreInitializer: StateCreator<AudioDataState, [], []> = (set) => ({
  ...INITIAL_AUDIO_DATA,
  setAudioData: (data) =>
    set(
      (state) => {
        // console.log('[Zustand AudioDataStore] Updating audioData with', data);
        return { ...state, ...data };
      },
      false,
      'audio/setAudioData'
    ),
  resetAudioData: () =>
    set(
      () => {
        // console.log('[Zustand AudioDataStore] Resetting audioData to initial');
        return INITIAL_AUDIO_DATA;
      },
      false,
      'audio/resetAudioData'
    ),
});

const createAudioDataStore =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
    ? devtools(audioDataStoreInitializer, { name: 'SIXRVisionAudioDataStore', store: 'audioData' })
    : audioDataStoreInitializer;

export const useAudioDataStore = create<AudioDataState>(createAudioDataStore);
