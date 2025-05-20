"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { SceneDefinition } from '@/types';
import { SCENES as BUILT_IN_SCENES } from '@/lib/constants';
import { useSettings } from './SettingsProvider';

type SceneContextType = {
  scenes: SceneDefinition[];
  currentScene: SceneDefinition | undefined;
  registerScene: (scene: SceneDefinition) => void;
  setCurrentSceneById: (id: string) => void;
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

  const setCurrentSceneById = useCallback((id: string) => {
    if (registeredScenes.find(s => s.id === id)) {
      updateSetting('currentSceneId', id);
    } else {
      console.warn(`Scene with id "${id}" not found.`);
    }
  }, [registeredScenes, updateSetting]);

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
