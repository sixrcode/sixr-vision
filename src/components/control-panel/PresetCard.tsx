
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
} & React.HTMLAttributes<HTMLDivElement>;

const PresetCard = React.forwardRef<HTMLDivElement, PresetCardProps>(
  ({ scene, isActive, onClick, onKeyDown, className, ...props }, ref) => {
    // Style object for text and border color, reacting to isActive state
    // This primarily sets the default text color for the card.
    const cardTextStyle: React.CSSProperties = {
      color: isActive ? 'hsl(var(--accent-foreground-hsl))' : 'hsl(var(--card-foreground-hsl))',
      borderColor: isActive ? 'hsl(var(--primary-hsl))' : 'hsl(var(--border-hsl))',
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? "ring-2 ring-primary bg-[hsl(36,98%,63%)]" // Active: SBNF Orange-Yellow (from --accent-hsl)
            : "bg-[hsl(258,56%,40%)]", // Inactive: SBNF Deep Purple (from --card-hsl)
          className
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Activate ${scene.name} preset`}
        aria-pressed={isActive}
        style={cardTextStyle} // Apply text color and border color style here
        {...props}
      >
        {/* CardContent now has p-2 for consistent padding */}
        <CardContent className="p-2 flex flex-col items-center">
          {scene.thumbnailUrl ? (
            <Image
              src={scene.thumbnailUrl}
              alt={scene.name}
              width={80}
              height={60}
              className="rounded-md object-cover w-full" // Ensure image is also rounded
              data-ai-hint={scene.dataAiHint || "abstract visual"}
            />
          ) : (
            // Placeholder div if no thumbnail, removed bg-muted
            // Text color will now be directly on the card's background
            <div className="w-full h-[60px] flex items-center justify-center rounded-md p-1">
              <span className={cn(
                "text-xs text-center break-words",
                // Text color explicitly set based on active state, should contrast with card background
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
