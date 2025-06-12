
import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SceneDefinition } from '@/types/state';
import { SCENES as BUILT_IN_SCENES, DEFAULT_SETTINGS } from '@/lib/constants';

interface SceneState {
  scenes: SceneDefinition[];
  currentSceneId: string;
  setCurrentSceneById: (id: string, reason?: string) => void;
  registerScene: (scene: SceneDefinition) => void;
  resetSceneState: () => void;
}

const sceneStoreInitializer: StateCreator<SceneState, [], []> = (set, get) => ({
  scenes: BUILT_IN_SCENES,
  currentSceneId: DEFAULT_SETTINGS.currentSceneId,

  setCurrentSceneById: (id, reason = 'unknown') => {
    const sceneExists = get().scenes.find(s => s.id === id);
    if (sceneExists) {
      set(
        () => ({ currentSceneId: id }),
        false,
        `scene/setCurrentSceneById/${id}`
      );
    } else {
      console.warn(`[Zustand SceneStore] Scene with id "${id}" not found. Cannot set.`);
    }
  },

  registerScene: (sceneToRegister: SceneDefinition) => {
    console.warn(
      `[Zustand SceneStore] Dynamic scene registration for "${sceneToRegister.name}" is a placeholder. Scene not added to active list.`
    );
    // Example for future:
    // set((state) => {
    //   if (!state.scenes.find(s => s.id === sceneToRegister.id)) {
    //     return { scenes: [...state.scenes, sceneToRegister] };
    //   }
    //   return {};
    // }, false, `scene/registerScene/${sceneToRegister.id}`);
  },

  resetSceneState: () =>
    set(
      () => ({
        scenes: BUILT_IN_SCENES,
        currentSceneId: DEFAULT_SETTINGS.currentSceneId,
      }),
      false,
      'scene/resetSceneState'
    ),
});

const createSceneStore =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
    ? devtools(sceneStoreInitializer, { name: 'SIXRVisionSceneStore', store: 'scene' })
    : sceneStoreInitializer;

export const useSceneStore = create<SceneState>(createSceneStore);
