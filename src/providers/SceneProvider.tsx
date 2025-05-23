
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
  setCurrentSceneById: (id: string, reason?: string) => void; // Added optional reason
};

const SceneContext = createContext<SceneContextType | undefined>(undefined);

export function SceneProvider({ children }: { children: ReactNode }) {
  const [registeredScenes, setRegisteredScenes] = useState<SceneDefinition[]>(BUILT_IN_SCENES);
  const { settings, updateSetting } = useSettings();

  const currentScene = useMemo(() => 
    registeredScenes.find(scene => scene.id === settings.currentSceneId),
    [registeredScenes, settings.currentSceneId]
  );

  const registerScene = useCallback((scene: SceneDefinition) => {
    setRegisteredScenes((prev) => {
      if (prev.find(s => s.id === scene.id)) {
        // Replace if already exists, or handle error/warning
        return prev.map(s => s.id === scene.id ? scene : s);
      }
      return [...prev, scene];
    });
  }, []);

  const setCurrentSceneById = useCallback(async (id: string, reason: string = 'manual_selection') => {
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
