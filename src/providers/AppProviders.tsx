"use client";

import type { ReactNode } from 'react';
import { SettingsProvider } from './SettingsProvider';
import { AudioDataProvider } from './AudioDataProvider';
import { SceneProvider } from './SceneProvider';
// Import other providers as they are created

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AudioDataProvider>
        <SceneProvider>
          {/* Wrap with other providers here */}
          {children}
        </SceneProvider>
      </AudioDataProvider>
    </SettingsProvider>
  );
}
