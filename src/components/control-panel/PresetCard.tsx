
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
    const cardStyle: React.CSSProperties = {
      backgroundColor: isActive ? 'hsl(var(--accent-hsl))' : 'hsl(var(--card-hsl))',
    };

    return (
      <Card
        ref={ref}
        style={cardStyle}
        className={cn(
          "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg",
          isActive
            ? "border-primary ring-2 ring-primary text-accent-foreground opacity-100" // text-accent-foreground for active card text
            : "border-border text-card-foreground", // text-card-foreground for inactive card text
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
              className="rounded-md object-cover w-full"
              data-ai-hint={scene.dataAiHint || "abstract visual"}
            />
          ) : (
            <div className="w-full h-[60px] flex items-center justify-center bg-muted rounded-md p-1">
              <span className={cn(
                "text-xs text-center break-words",
                isActive ? "text-accent-foreground" : "text-muted-foreground"
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
