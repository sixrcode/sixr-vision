
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
    <AccordionItem value={value} className={cn("border-b-0", className)}>
      <AccordionTrigger className="py-2 text-sm font-semibold text-[hsl(var(--control-panel-foreground))] opacity-90 hover:opacity-100 hover:no-underline justify-start [&[data-state=open]>svg]:ml-auto">
        <span className="px-2 truncate">{title.toUpperCase()}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <div className="px-2 py-3 space-y-4 bg-[hsl(var(--background))] rounded-md shadow-sm">
           {children}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
