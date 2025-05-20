
"use client";
import type { ReactNode } from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type ControlPanelSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  value: string; // Required for AccordionItem
};

export function ControlPanelSection({ title, children, className, value }: ControlPanelSectionProps) {
  return (
    <AccordionItem value={value} className={cn("border-b border-[hsl(var(--control-panel-border))]", className)}>
      <AccordionTrigger className="py-2 text-sm font-semibold text-[hsl(var(--control-panel-foreground))] opacity-90 hover:opacity-100 hover:no-underline justify-start [&[data-state=open]>svg]:ml-auto">
        <span className="px-2 truncate">{title.toUpperCase()}</span>
      </AccordionTrigger>
      <AccordionContent className={cn(
        "bg-[hsl(var(--background))] rounded-b-md shadow-sm", // Background, rounding, shadow
        "px-2 pt-2 pb-3" // Padding: pb-3 to ensure content doesn't touch bottom, pt-2 to match trigger proximity
      )}>
         {/* The children (e.g., divs from AudioControls) will be spaced by their own space-y utilities */}
         {/* If spacing *between* child groups passed to ControlPanelSection is needed, it must be handled by wrapping children or applying margin */}
        <div className="space-y-4"> {/* This div ensures spacing between groups of controls passed as children */}
           {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
