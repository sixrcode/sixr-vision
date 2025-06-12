
"use client";

import type { ReactNode } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import InitPromptOverlay from '@/components/InitPromptOverlay'; // Import the new component

export function AppContainer({
  visualizer,
  controlPanel,
}: {
  visualizer: ReactNode;
  controlPanel: ReactNode;
}) {
  useHotkeys(); 

  return (
    <>
      <InitPromptOverlay /> {/* Add the overlay here */}
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <SidebarInset>
          <main id="main-content" className="flex-1 h-full relative overflow-hidden">
            {visualizer}
          </main>
        </SidebarInset>

        {/* Sidebar Trigger - always positioned in the top-right corner */}
        <div
          className={cn(
            "absolute z-50 top-4 right-4"
          )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              <p>Toggle Control Panel (Ctrl+B)</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <Sidebar side="right" collapsible="offcanvas">
          {controlPanel}
        </Sidebar>
      </div>
    </>
  );
}
