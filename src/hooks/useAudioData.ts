import { useAudioDataStore, State } from '@/store/audioDataStore';

export function useAudioData<T>(selector: (state: State) => T): T {
  return useAudioDataStore(selector);
}