
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { SceneDefinition, Settings } from '@/types';
import { SCENES as BUILT_IN_SCENES } from '@/lib/constants';
import { useSettings } from './SettingsProvider';
import { addLogEntry } from '@/services/rehearsalLogService';

type SceneContextType = {
  scenes: SceneDefinition[];
  currentScene: SceneDefinition | undefined;
  registerScene: (scene: SceneDefinition) => void;
  setCurrentSceneById: (id: string, reason?: string) => void;
};

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [registeredScenes, setRegisteredScenes] = useState<SceneDefinition[]>(() => {
    if (Array.isArray(BUILT_IN_SCENES)) {
      return BUILT_IN_SCENES;
    }
    console.error("SceneProvider: BUILT_IN_SCENES is not a valid array. Defaulting to empty scenes list.", BUILT_IN_SCENES);
    return [];
  });

  const { settings, updateSetting } = useSettings();

  const currentScene = useMemo(() => {
    if (!settings) {
      console.warn("SceneProvider: 'settings' from useSettings() is unexpectedly falsy during currentScene memoization. Current scene might be incorrect.");
      return undefined;
    }
    return registeredScenes.find(scene => scene.id === settings.currentSceneId);
  }, [registeredScenes, settings]);

  const setCurrentSceneById = useCallback(async (id: string, reason: string = 'manual_selection') => {
    if (!settings) {
        console.warn("SceneProvider: 'settings' is unavailable in setCurrentSceneById. Cannot proceed.");
        return;
    }
    if (!Array.isArray(registeredScenes)) {
      console.error("SceneProvider: registeredScenes is not an array during setCurrentSceneById.");
      return;
    }
    const sceneExists = registeredScenes.find(s => s.id === id);
    if (sceneExists) {
      const oldSceneId = settings.currentSceneId;
      updateSetting('currentSceneId', id);
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
  }, [registeredScenes, updateSetting, settings]);

  // Define registerScene as a plain function directly within the component scope
  // This is a diagnostic step to bypass potential SSR issues with useCallback for this specific function.
  const registerScene = (sceneToRegister: SceneDefinition): void => {
    console.warn(`Dynamic scene registration for "${sceneToRegister.id}" is a placeholder. Scene not added to active list.`);
    // Placeholder: In a real implementation, you might update `registeredScenes` state:
    // setRegisteredScenes(prevScenes => {
    //   if (!prevScenes.find(s => s.id === sceneToRegister.id)) {
    //     return [...prevScenes, sceneToRegister];
    //   }
    //   return prevScenes;
    // });
  };

  const providerValue = {
    scenes: registeredScenes,
    currentScene,
    registerScene, // Use the plain function
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
    // This error should be hit if the provider is not wrapping the consumer,
    // or if the context value itself is somehow still undefined.
    console.error("useScene must be used within a SceneProvider. Context is undefined.");
    // Fallback to a default shape to prevent further errors, though this indicates a problem.
    return {
        scenes: [],
        currentScene: undefined,
        registerScene: () => console.error("Default registerScene called - SceneProvider context issue."),
        setCurrentSceneById: () => console.error("Default setCurrentSceneById called - SceneProvider context issue."),
    };
  }
  return context;
}
