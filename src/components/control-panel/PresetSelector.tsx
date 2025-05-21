
"use client";

import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PresetCard } from './PresetCard';

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
            <Tooltip key={scene.id} delayDuration={300}>
              <TooltipTrigger asChild>
                <PresetCard
                  scene={scene}
                  isActive={settings.currentSceneId === scene.id}
                  onClick={() => setCurrentSceneById(scene.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentSceneById(scene.id)}
                />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
                style={{
                  backgroundColor: 'hsl(var(--popover-hsl))',
                  color: 'hsl(var(--popover-foreground-hsl))',
                  borderColor: 'hsl(var(--border-hsl))',
                  borderWidth: '1px',
                  zIndex: 50, // Ensure it's above other elements
                }}
              >
                <p className="font-semibold">{scene.name}</p>
                {scene.dataAiHint && (
                  <p className="text-xs text-muted-foreground">{scene.dataAiHint}</p>
                )}
                {!scene.dataAiHint && (
                   <p className="text-xs text-muted-foreground">Audio-reactive visualizer scene.</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </ControlPanelSection>
  );
}
