
"use client";

import { useEffect, useCallback } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import { useScene } from '@/providers/SceneProvider';

type HotkeyMap = {
  [key: string]: (event: KeyboardEvent) => void;
};

export function useHotkeys() {
  const { updateSetting, settings } = useSettings();
  const { scenes, setCurrentSceneById } = useScene();

  const handleHotkey = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;

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
      'p': () => updateSetting('panicMode', !settings.panicMode),
      'l': () => updateSetting('logoBlackout', !settings.logoBlackout),
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
  }, [scenes, setCurrentSceneById, updateSetting, settings]);

  useEffect(() => {
    window.addEventListener('keydown', handleHotkey);
    return () => {
      window.removeEventListener('keydown', handleHotkey);
    };
  }, [handleHotkey]);
}
