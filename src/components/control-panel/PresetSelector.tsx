"use client";

import Image from 'next/image';
import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ControlPanelSection } from './ControlPanelSection';

export function PresetSelector() {
  const { scenes, setCurrentSceneById } = useScene();
  const { settings } = useSettings();

  return (
    <ControlPanelSection title="Presets">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-3 pb-3">
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className={cn(
                "w-[120px] h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg hover:border-primary",
                settings.currentSceneId === scene.id && "border-primary ring-2 ring-primary"
              )}
              onClick={() => setCurrentSceneById(scene.id)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setCurrentSceneById(scene.id)}
            >
              <CardContent className="p-0 flex flex-col items-center">
                {scene.thumbnailUrl && (
                  <Image
                    src={scene.thumbnailUrl}
                    alt={scene.name}
                    width={120}
                    height={80}
                    className="rounded-t-md object-cover"
                    data-ai-hint={scene.dataAiHint || "abstract visual"}
                  />
                )}
                <p className="text-xs font-medium p-1.5 truncate w-full text-center text-[hsl(var(--card-foreground))]">
                  {scene.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Morphing Engine: Placeholder</p>
    </ControlPanelSection>
  );
}
