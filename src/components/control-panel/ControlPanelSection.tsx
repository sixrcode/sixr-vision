"use client";
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type ControlPanelSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean; // For potential future accordion use
};

export function ControlPanelSection({ title, children, className }: ControlPanelSectionProps) {
  // Using Card for styling, can be replaced with Accordion for collapsibility
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold mb-2 px-4 text-[hsl(var(--control-panel-foreground))] opacity-70">{title.toUpperCase()}</h3>
      <div className="px-4 py-3 space-y-4 bg-[hsl(var(--background))] rounded-md shadow-sm mx-2">
         {children}
      </div>
      <Separator className="my-4 bg-[hsl(var(--control-panel-border))] opacity-50 mx-2" />
    </div>
  );
}
