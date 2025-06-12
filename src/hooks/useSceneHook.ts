
"use client";

import { useSceneStore } from '@/store/sceneStore';
import type { SceneDefinition } from '@/types/state';

// Assuming SceneState from sceneStore.ts looks something like:
// interface SceneState {
//   scenes: SceneDefinition[];
//   currentSceneId: string;
//   // ... actions
// }

/**
 * Custom hook to select parts of the scene state from the Zustand store.
 *
 * @template T - The type of the selected state slice.
 * @param {(state: { scenes: SceneDefinition[]; currentSceneId: string }) => T} selector - A function that selects a slice of the state.
 * @returns {T} The selected state slice.
 *
 * @example
 * const currentSceneId = useSceneHook(state => state.currentSceneId);
 * const scenes = useSceneHook(state => state.scenes);
 */
export function useSceneHook<T>(
  selector: (state: { scenes: SceneDefinition[]; currentSceneId: string }) => T
): T {
  // Select only the state properties, not the actions, if the selector is for state.
  // If actions are needed, a separate hook or a more complex selector can be used.
  return useSceneStore(selector);
}

// Example of a hook that returns the current scene object
// export function useCurrentScene(): SceneDefinition | undefined {
//   return useSceneStore(state => state.scenes.find(scene => scene.id === state.currentSceneId));
// }

// Example of a hook that returns scene actions
// export function useSceneActions() {
//   return useSceneStore((state) => ({
//     setCurrentSceneById: state.setCurrentSceneById,
//     registerScene: state.registerScene,
//   }));
// }
