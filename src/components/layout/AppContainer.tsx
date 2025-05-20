
"use client";

import type { ReactNode } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Sidebar, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function AppContainer({
  visualizer,
  controlPanel,
}: {
  visualizer: ReactNode;
  controlPanel: ReactNode;
}) {
  useHotkeys(); // Initialize hotkeys listener
  // useSidebar hook is not strictly needed here anymore for conditional rendering of the trigger's container
  // as it will always be in the same position.

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SidebarInset>
        <main className="flex-1 h-full relative overflow-hidden">
          {visualizer}
        </main>
      </SidebarInset>

      {/* Sidebar Trigger - always positioned in the top-right corner */}
      <div
        className={cn(
          "absolute z-50 top-4 right-4"
        )}
      >
        <SidebarTrigger />
      </div>
      
      <Sidebar side="right" collapsible="offcanvas">
        {controlPanel}
      </Sidebar>
    </div>
  );
}
