
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
    <AccordionItem value={value} className={cn("border-b border-sidebar-border", className)}>
      <AccordionTrigger className={cn(
        "py-2 text-sm font-semibold text-sidebar-foreground opacity-90 hover:opacity-100 hover:no-underline",
        // Removed: justify-start [&[data-state=open]>svg]:ml-auto
        // Base AccordionTrigger from shadcn/ui already has justify-between
      )}>
        <span className="px-2 truncate">{title.toUpperCase()}</span>
      </AccordionTrigger>
      <AccordionContent className={cn(
        "bg-background rounded-b-md shadow-sm",
        "px-2 pt-2 pb-3"
      )}>
        <div className="space-y-4">
           {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
