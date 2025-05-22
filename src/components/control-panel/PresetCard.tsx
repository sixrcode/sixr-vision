
"use client";

import * as React from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SceneDefinition } from '@/types';

type PresetCardProps = {
  scene: SceneDefinition;
  isActive: boolean;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
} & React.HTMLAttributes<HTMLDivElement>; // Allow other HTMLDivElement props like ref

const PresetCard = React.forwardRef<HTMLDivElement, PresetCardProps>(
  ({ scene, isActive, onClick, onKeyDown, className, ...props }, ref) => {
    // Manage text color with inline style for direct control over text on card background
    const cardTextStyle: React.CSSProperties = {
      color: isActive ? 'hsl(var(--accent-foreground-hsl))' : 'hsl(var(--card-foreground-hsl))',
    };

    return (
      <Card
        ref={ref}
        style={cardTextStyle} // Apply text color style here
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? "bg-accent border-primary ring-2 ring-primary opacity-100" // Active: accent bg, primary border/ring
            : "bg-card border-border", // Inactive: card bg, default border
          className
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Activate ${scene.name} preset`}
        aria-pressed={isActive}
        {...props}
      >
        <CardContent className="p-0 flex flex-col items-center">
          {scene.thumbnailUrl ? (
            <Image
              src={scene.thumbnailUrl}
              alt={scene.name}
              width={80}
              height={60}
              className="rounded-md object-cover w-full" // Rounded on all corners
              data-ai-hint={scene.dataAiHint || "abstract visual"}
            />
          ) : (
            <div className="w-full h-[60px] flex items-center justify-center bg-muted rounded-md p-1">
              {/* Text inside placeholder div, explicitly set color for contrast with bg-muted */}
              <span className={cn(
                "text-xs text-center break-words",
                isActive ? "text-accent-foreground" : "text-card-foreground" 
              )}>
                {scene.name}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

PresetCard.displayName = 'PresetCard';

export { PresetCard };
