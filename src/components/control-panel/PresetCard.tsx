
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
    // Style object primarily for border color, reacting to isActive state
    const cardBorderStyle: React.CSSProperties = {
      borderColor: isActive ? 'hsl(var(--primary-hsl))' : 'hsl(var(--border-hsl))',
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? `bg-[hsl(36,98%,63%)] border-primary ring-2 ring-primary` // SBNF Orange-Yellow
            : `bg-[hsl(258,56%,40%)] border-border`, // SBNF Deep Purple
          className
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Activate ${scene.name} preset`}
        aria-pressed={isActive}
        style={cardBorderStyle}
        {...props}
      >
        <CardContent className="p-2 flex flex-col items-center justify-start gap-1">
          {scene.thumbnailUrl ? (
            <Image
              src={scene.thumbnailUrl}
              alt={scene.name}
              width={80}
              height={60}
              className="rounded-md object-cover w-full h-[60px]" // Fixed height for image consistency
              data-ai-hint={scene.dataAiHint || "abstract visual"}
            />
          ) : (
            // Placeholder div if no thumbnail
            <div className="w-full h-[60px] flex items-center justify-center rounded-md p-1">
              {/* Scene name is displayed below if no thumbnail */}
            </div>
          )}
          <div className="w-full text-center mt-1">
            <span className={cn(
              "text-xs font-medium break-words line-clamp-2 leading-tight h-[2.5em]", // Allow up to 2 lines, fixed height
              isActive ? "text-accent-foreground" : "text-card-foreground"
            )}>
              {scene.name}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
);

PresetCard.displayName = 'PresetCard';

export { PresetCard };

