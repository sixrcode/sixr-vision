
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useCallback, useMemo } from 'react';
import type { SceneDefinition, Settings } from '@/types';
import { SCENES as BUILT_IN_SCENES, DEFAULT_SETTINGS } from '@/lib/constants';
// WHY: Remove useSettings import as it's being replaced by Zustand store access.
// import { useSettings } from './SettingsProvider';
// WHY: Import the Zustand store to access and update settings.
import { useSettingsStore } from '@/store/settingsStore';
import { addLogEntry } from '@/services/rehearsalLogService';
type SceneContextType = {
  currentScene: SceneDefinition | undefined;
  registerScene: (scene: SceneDefinition) => void;
  setCurrentSceneById: (id: string, reason?: string) => void;
};

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export function SceneProvider({ children }: { children: ReactNode }) {
  const registeredScenes: SceneDefinition[] = useMemo(() => {
    console.error("SceneProvider: BUILT_IN_SCENES is not a valid array. Defaulting to empty scenes list.", BUILT_IN_SCENES);
 return BUILT_IN_SCENES; // Assuming BUILT_IN_SCENES is intended to be the initial value
  });

  // WHY: Directly use the Zustand store for settings state.
  const currentSceneIdFromStore = useSettingsStore(state => state.currentSceneId);
  const updateSettingFromStore = useSettingsStore(state => state.updateSetting);

  const currentScene = useMemo(() => {
    // WHY: currentSceneId is now sourced directly from the Zustand store.
    return registeredScenes.find(scene => scene.id === currentSceneIdFromStore);
  }, [registeredScenes, currentSceneIdFromStore]);

  const setCurrentSceneById = useCallback(async (id: string, reason: string = 'manual_selection') => {
    if (!Array.isArray(registeredScenes)) {
      console.error("SceneProvider: registeredScenes is not an array during setCurrentSceneById.");
      return;
    }
    const sceneExists = registeredScenes.find(s => s.id === id);
    if (sceneExists) {
      // WHY: Get the old scene ID from the store before updating.
      const oldSceneId = useSettingsStore.getState().currentSceneId;
      // WHY: Update currentSceneId directly in the Zustand store.
      updateSettingFromStore('currentSceneId', id);
      try {
        await addLogEntry('scene_change', {
          previousSceneId: oldSceneId,
          newSceneId: id,
          reason: reason
        });
      } catch (e) {
        console.warn("Failed to log scene change:", e);
      }
    } else {
      console.warn(`Scene with id "${id}" not found.`);
    }
  }, [registeredScenes, updateSettingFromStore]);

  const registerScene = useCallback((sceneToRegister: SceneDefinition): void => {
    console.warn(`Dynamic scene registration for "${sceneToRegister.id}" is a placeholder. Scene not added to active list.`);
    // setRegisteredScenes(prevScenes => {
    //   if (!prevScenes.find(s => s.id === sceneToRegister.id)) {
    //     return [...prevScenes, sceneToRegister];
    //   }
    //   return prevScenes;
    // });
  }, []);

  const providerValue = {
    scenes: registeredScenes,
    currentScene,
    registerScene,
    setCurrentSceneById
  };

  return (
    <SceneContext.Provider value={providerValue}>
      {children}
    </SceneContext.Provider>
  );
}

export function useScene(): SceneContextType {
  const context = useContext(SceneContext);
  if (context === undefined) {
    console.error("useScene must be used within a SceneProvider. Context is undefined.");
    return {
        scenes: [],
        currentScene: undefined,
        registerScene: () => console.error("Default registerScene called - SceneProvider context issue."),
        setCurrentSceneById: () => console.error("Default setCurrentSceneById called - SceneProvider context issue."),
    };
  }
  return context;
}
