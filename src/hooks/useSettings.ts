import { useSettingsStore, State } from '@/store/settingsStore';

export function useSettings<T>(selector: (state: State) => T): T {
  return useSettingsStore(selector);
}