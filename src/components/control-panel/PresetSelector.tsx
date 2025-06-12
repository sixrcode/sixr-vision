
"use client";

import { useSceneStore } from '@/store/sceneStore'; // MODIFIED: Import Zustand store
import { useSettingsStore } from '@/store/settingsStore'; // MODIFIED: Import Zustand store

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ControlPanelSection } from './ControlPanelSection';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PresetCard } from './PresetCard';

type PresetSelectorProps = {
  value: string; // For AccordionItem
};

export function PresetSelector({ value }: PresetSelectorProps) {
  // MODIFIED: Use Zustand stores
  const { scenes, setCurrentSceneById } = useSceneStore(state => ({
    scenes: state.scenes,
    setCurrentSceneById: state.setCurrentSceneById,
  }));
  const currentSceneId = useSettingsStore(state => state.currentSceneId);

  return (
    <ControlPanelSection title="Presets" value={value}>
      <ScrollArea className="w-full h-auto max-h-[300px]">
        <div className="grid grid-cols-3 gap-2 p-1">
          {scenes.map((scene) => (
            <Tooltip key={scene.id}>
              <TooltipTrigger asChild>
                <PresetCard
                  scene={scene}
                  isActive={currentSceneId === scene.id}
                  onClick={() => setCurrentSceneById(scene.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCurrentSceneById(scene.id);
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{scene.name}</p>
                {scene.dataAiHint && (
                  <p className="text-xs text-muted-foreground">{scene.dataAiHint}</p>
                )}
                {!scene.dataAiHint && (
                   <p className="text-xs text-muted-foreground">Tooltip for {scene.name}.</p>
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
