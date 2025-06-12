
"use client";

import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore'; // MODIFIED: Import Zustand store
import { useSceneStore } from '@/store/sceneStore'; // MODIFIED: Import Zustand store
import { SCENES as allScenesConstant } from '@/lib/constants'; // MODIFIED: Import SCENES directly
import type { Settings } from '@/types';

type HotkeyMap = {
  [key: string]: (event: KeyboardEvent) => void;
};

export function useHotkeys() {
  // MODIFIED: Use Zustand store actions and selectors
  const updateSetting = useSettingsStore(state => state.updateSetting);
  const panicMode = useSettingsStore(state => state.panicMode);
  const logoBlackout = useSettingsStore(state => state.logoBlackout);
  
  const scenes = allScenesConstant; // Scenes are static
  const setCurrentSceneById = useSceneStore(state => state.setCurrentSceneById);

  const handleHotkey = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;

    // Create settings object from Zustand state for convenience in callbacks
    const currentSettings = { panicMode, logoBlackout };

    const hotkeyActions: HotkeyMap = {
      '1': () => scenes[0] && setCurrentSceneById(scenes[0].id),
      '2': () => scenes[1] && setCurrentSceneById(scenes[1].id),
      '3': () => scenes[2] && setCurrentSceneById(scenes[2].id),
      '4': () => scenes[3] && setCurrentSceneById(scenes[3].id),
      '5': () => scenes[4] && setCurrentSceneById(scenes[4].id),
      '6': () => scenes[5] && setCurrentSceneById(scenes[5].id),
      '7': () => scenes[6] && setCurrentSceneById(scenes[6].id),
      '8': () => scenes[7] && setCurrentSceneById(scenes[7].id),
      '9': () => scenes[8] && setCurrentSceneById(scenes[8].id),
      'p': () => updateSetting('panicMode', !currentSettings.panicMode),
      'l': () => updateSetting('logoBlackout', !currentSettings.logoBlackout),
      // 'z' with Ctrl/Meta for undo - placeholder for now
      // 'z': () => {
      //   if (isCtrlOrMeta) {
      //     event.preventDefault();
      //     console.log("Undo action triggered (placeholder)");
      //     // Implement undo logic here if/when available
      //   }
      // },
    };

    // Prevent hotkeys from firing if an input field is focused
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
      return;
    }

    if (hotkeyActions[key]) {
      // Allow specific combinations like Ctrl+Z, otherwise only plain keys
      if (key === 'z' && !isCtrlOrMeta) return; // if 'z' is not for undo by itself
      if (key !== 'z' && isCtrlOrMeta && !['1','2','3','4','5','6','7','8','9','p','l'].includes(key) ) return; // Prevent other standard ctrl/meta actions unless specifically handled
      
      event.preventDefault();
      hotkeyActions[key](event);
    }
  }, [scenes, setCurrentSceneById, updateSetting, panicMode, logoBlackout]); // MODIFIED: Dependencies

  useEffect(() => {
    window.addEventListener('keydown', handleHotkey);
    return () => {
      window.removeEventListener('keydown', handleHotkey);
    };
  }, [handleHotkey]);
}
