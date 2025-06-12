
"use client";

import type { ReactNode } from 'react';
// WHY: SettingsProvider is no longer needed as settings are managed by Zustand store.
// import { SettingsProvider } from './SettingsProvider';
import { AudioDataProvider } from './AudioDataProvider';
import { SceneProvider } from './SceneProvider';
// Import other providers as they are created

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // WHY: SettingsProvider wrapper is removed.
    // <SettingsProvider>
      <AudioDataProvider>
        <SceneProvider>
          {/* Wrap with other providers here */}
          {children}
        </SceneProvider>
      </AudioDataProvider>
    // </SettingsProvider>
  );
}
