
import { create, type StateCreator } from 'zustand';
// import { devtools } from 'zustand/middleware'; // Temporarily remove devtools
import type { SceneDefinition } from '@/types/state';
import { SCENES as BUILT_IN_SCENES, DEFAULT_SETTINGS } from '@/lib/constants';

interface SceneState {
  scenes: SceneDefinition[];
  currentSceneId: string;
  setCurrentSceneById: (id: string) => void;
  registerScene: (scene: SceneDefinition) => void;
  resetSceneState: () => void;
}

const sceneStoreInitializer: StateCreator<SceneState, [], []> = (set, get) => ({
  scenes: Array.isArray(BUILT_IN_SCENES) ? BUILT_IN_SCENES : [],
  currentSceneId: DEFAULT_SETTINGS.currentSceneId,

  setCurrentSceneById: (id) => {
    const currentScenes = get().scenes;
    const sceneExists = currentScenes.find(s => s.id === id);
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
        scenes: Array.isArray(BUILT_IN_SCENES) ? BUILT_IN_SCENES : [],
        currentSceneId: DEFAULT_SETTINGS.currentSceneId,
      }),
      false,
      'scene/resetSceneState',
    ),
});

// Temporarily use the initializer directly without devtools
export const useSceneStore = create<SceneState>(sceneStoreInitializer);

/*
// Original conditional logic for devtools:
const createSceneStore =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
    ? devtools(sceneStoreInitializer, { name: 'SIXRVisionSceneStore', store: 'scene' })
    : sceneStoreInitializer;

export const useSceneStore = create<SceneState>(createSceneStore);
*/
