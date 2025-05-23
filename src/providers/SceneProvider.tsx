
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { SceneDefinition } from '@/types';
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
    // Ensure BUILT_IN_SCENES is a valid array before setting state
    if (Array.isArray(BUILT_IN_SCENES)) {
      return BUILT_IN_SCENES;
    }
    console.error("SceneProvider: BUILT_IN_SCENES is not a valid array. Defaulting to empty scenes list.", BUILT_IN_SCENES);
    return [];
  });
  const { settings, updateSetting } = useSettings();

  const currentScene = useMemo(() => 
    registeredScenes.find(scene => scene.id === settings.currentSceneId),
    [registeredScenes, settings.currentSceneId]
  );

  const registerScene = useCallback((scene: SceneDefinition) => {
    setRegisteredScenes((prev) => {
      if (!Array.isArray(prev)) { // Should not happen if initial state is correct
        console.error("SceneProvider: previous registeredScenes is not an array during registerScene.");
        return [scene];
      }
      if (prev.find(s => s.id === scene.id)) {
        return prev.map(s => s.id === scene.id ? scene : s);
      }
      return [...prev, scene];
    });
  }, []);

  const setCurrentSceneById = useCallback(async (id: string, reason: string = 'manual_selection') => {
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
  }, [registeredScenes, updateSetting, settings.currentSceneId]);

  return (
    <SceneContext.Provider value={{ scenes: registeredScenes, currentScene, registerScene, setCurrentSceneById }}>
      {children}
    </SceneContext.Provider>
  );
}

export function useScene(): SceneContextType {
  const context = useContext(SceneContext);
  if (context === undefined) {
    throw new Error('useScene must be used within a SceneProvider');
  }
  return context;
}
