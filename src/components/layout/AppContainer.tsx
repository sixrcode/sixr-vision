"use client";

import type { ReactNode } from 'react';
import { CONTROL_PANEL_WIDTH } from '@/lib/constants';
import { useHotkeys } from '@/hooks/useHotkeys';

export function AppContainer({
  visualizer,
  controlPanel,
}: {
  visualizer: ReactNode;
  controlPanel: ReactNode;
}) {
  useHotkeys(); // Initialize hotkeys listener

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <main className="flex-1 h-full relative overflow-hidden">
        {visualizer}
      </main>
      <aside
        className="h-full shadow-2xl bg-[hsl(var(--control-panel-background))] text-[hsl(var(--control-panel-foreground))] border-l border-[hsl(var(--control-panel-border))]"
        style={{ width: `${CONTROL_PANEL_WIDTH}px` }}
      >
        {controlPanel}
      </aside>
    </div>
  );
}
