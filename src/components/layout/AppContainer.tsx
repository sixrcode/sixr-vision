
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
  const { open: isDesktopSidebarOpen, isMobile } = useSidebar();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SidebarInset>
        <main className="flex-1 h-full relative overflow-hidden">
          {visualizer}
        </main>
      </SidebarInset>

      {/* Sidebar Trigger - positioned based on mobile/desktop and sidebar state */}
      <div
        className={cn(
          "absolute z-50",
          isMobile ? "top-4 right-4" : "top-1/2 right-4 -translate-y-1/2",
          !isMobile && isDesktopSidebarOpen && "hidden" // Hide on desktop if sidebar is open
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
