
"use client";

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SceneDefinition } from '@/types';

type PresetCardProps = {
  scene: SceneDefinition;
  isActive: boolean;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

export function PresetCard({ scene, isActive, onClick, onKeyDown }: PresetCardProps) {
  return (
    <Card
      className={cn(
        "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg hover:border-primary",
        isActive && "border-primary ring-2 ring-primary bg-accent"
      )}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Activate ${scene.name} preset`}
      aria-pressed={isActive}
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
            <span className="text-xs text-muted-foreground text-center break-words">
              {scene.name}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
