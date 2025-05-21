
"use client";

import { useScene } from '@/providers/SceneProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
// PresetCard import is removed for this test
// import { PresetCard } from './PresetCard';

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
            <Tooltip key={scene.id}>
              <TooltipTrigger asChild>
                {/* Temporarily replaced PresetCard with a simple button for testing */}
                <button
                  className="p-2 border rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary w-full h-full min-h-[76px] text-xs flex items-center justify-center text-center break-all"
                  onClick={() => setCurrentSceneById(scene.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentSceneById(scene.id)}
                  aria-label={`Activate ${scene.name} preset`}
                  aria-pressed={settings.currentSceneId === scene.id}
                >
                  {scene.name} {/* Display scene name on button for identification */}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
              >
                <p className="font-semibold">{scene.name}</p>
                {scene.dataAiHint && (
                  <p className="text-xs text-muted-foreground">{scene.dataAiHint}</p>
                )}
                {!scene.dataAiHint && (
                   <p className="text-xs text-muted-foreground">Test: This is the tooltip for {scene.name}.</p>
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
