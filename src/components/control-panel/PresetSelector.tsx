
"use client";

import Image from 'next/image';
import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ControlPanelSection } from './ControlPanelSection';

type PresetSelectorProps = {
  value: string; // For AccordionItem
};

export function PresetSelector({ value }: PresetSelectorProps) {
  const { scenes, setCurrentSceneById } = useScene();
  const { settings } = useSettings();

  return (
    <ControlPanelSection title="Presets" value={value}>
      <ScrollArea className="w-full h-auto max-h-[300px]">
        <div className="grid grid-cols-3 gap-2 p-1">
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className={cn(
                "w-full h-auto shrink-0 cursor-pointer transition-all hover:shadow-lg hover:border-primary",
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
                    width={80}
                    height={60}
                    className="rounded-t-md object-cover w-full"
                    data-ai-hint={scene.dataAiHint || "abstract visual"}
                  />
                )}
                <p className={cn(
                  "text-[11px] p-1 truncate w-full text-center leading-tight",
                  settings.currentSceneId === scene.id
                    ? "text-primary font-semibold"
                    : "text-[hsl(var(--card-foreground))] font-medium"
                )}>
                  {scene.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 px-1">Scene Transitions: Crossfade</p>
    </ControlPanelSection>
  );
}
