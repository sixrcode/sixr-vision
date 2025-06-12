import { useSceneStore, SceneState } from '@/store/sceneStore';

export function useScene<T>(selector: (state: SceneState) => T): T {
  return useSceneStore(selector);
}