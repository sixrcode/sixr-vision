
"use client";

import * as React from "react";
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
    // Inline styles for direct control over background and border colors
    // to combat potential specificity issues with Tailwind classes on Card component.
    const cardStyle: React.CSSProperties = {
      borderColor: isActive ? 'hsl(var(--primary-hsl))' : 'hsl(var(--border-hsl))',
      // Background color will be applied via Tailwind classes for better theme integration
    };

    return (
      <Card
        ref={ref}
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive
            ? `border-primary ring-2 ring-primary bg-[hsl(var(--accent-hsl))]` // SBNF Orange-Yellow
            : `border-border bg-[hsl(var(--card-hsl))]`, // SBNF Deep Purple (Card background)
          className
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Activate ${scene.name} preset`}
        aria-pressed={isActive}
        style={cardStyle} // Apply border color via style for consistency
        {...props}
      >
        <CardContent className="p-2 flex flex-col items-center justify-center">
          {/* Main content: Display scene.id (short label) */}
          <div className="w-full h-[60px] flex items-center justify-center text-center">
            <span
              className={cn(
                "text-xs font-medium break-words line-clamp-2 leading-tight",
                isActive ? "text-accent-foreground" : "text-card-foreground" // Explicit text colors
              )}
            >
              {scene.displayLabel || scene.id} {/* Use displayLabel, fallback to id */}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }
);

PresetCard.displayName = 'PresetCard';

export { PresetCard };
