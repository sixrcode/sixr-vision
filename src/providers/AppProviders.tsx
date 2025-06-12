
"use client";

import type { ReactNode } from 'react';
// SettingsProvider, AudioDataProvider, SceneProvider imports are removed.
// Import other providers as they are created (if any remain or are added later)

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // SettingsProvider, AudioDataProvider, and SceneProvider wrappers are removed.
    // If other global providers were here, they would remain.
    // For now, it simplifies to just rendering children.
    <>
      {children}
    </>
  );
}
