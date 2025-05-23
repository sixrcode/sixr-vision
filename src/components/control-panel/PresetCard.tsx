
"use client";

import * as React from 'react';
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
    const cardBorderStyle: React.CSSProperties = {
      borderColor: isActive ? 'hsl(var(--primary-hsl))' : 'hsl(var(--border-hsl))',
    };

    // Card background color is now handled by Tailwind classes directly
    // Card text color is handled by Tailwind classes on the text span

    return (
      <Card
        ref={ref}
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? `border-primary ring-2 ring-primary bg-[hsl(var(--accent-hsl))]` // SBNF Orange-Yellow
            : `border-border bg-[hsl(var(--card-hsl))]`, // SBNF Deep Purple
          className
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Activate ${scene.name} preset`} // Tooltip will show full name
        aria-pressed={isActive}
        style={cardBorderStyle} // Only border color applied via style
        {...props}
      >
        <CardContent className="p-2 flex flex-col items-center justify-center">
          {/* Main content: Display scene.id */}
          <div className="w-full h-[60px] flex items-center justify-center text-center">
            <span className={cn(
              "text-xs font-medium break-words line-clamp-2 leading-tight",
              isActive ? "text-accent-foreground" : "text-card-foreground"
            )}>
              {scene.id} {/* Changed from scene.name to scene.id */}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
);

PresetCard.displayName = 'PresetCard';

export { PresetCard };
