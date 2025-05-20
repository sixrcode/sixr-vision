
"use client";

import type { ReactNode } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

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
      <SidebarInset>
        {/* SidebarTrigger for mobile */}
        <div className="absolute top-4 left-4 z-50 md:hidden">
          <SidebarTrigger />
        </div>
        <main className="flex-1 h-full relative overflow-hidden">
          {visualizer}
        </main>
      </SidebarInset>
      <Sidebar side="right" collapsible="offcanvas">
        {controlPanel}
      </Sidebar>
    </div>
  );
}
